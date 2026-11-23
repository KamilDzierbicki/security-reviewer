import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository as OrmRepository } from 'typeorm';
import { scanConfig } from '../config/namespaces.js';
import { isUniqueViolation } from '../database/postgres-errors.js';
import { enqueuePrepare, SCAN_QUEUE } from '../pipeline/queues.js';
import { RepositoriesService } from '../repositories/repositories.service.js';
import { ScanRun } from './scan-run.entity.js';
import { ScanStage } from './scan-stage.entity.js';
import { ACTIVE_RUN_STATUSES, STAGE_NAMES } from './scan.types.js';

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ScanRun) private readonly runs: OrmRepository<ScanRun>,
    private readonly repositories: RepositoriesService,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
    @InjectQueue(SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  async startLatest(
    ownerId: string,
    repositoryId: string,
  ): Promise<{ run: ScanRun; created: boolean }> {
    await this.repositories.getOwned(ownerId, repositoryId);
    const maxActive = this.scan.maxActiveRunsPerUser;

    let result: { run: ScanRun; created: boolean };
    try {
      result = await this.dataSource.transaction(async (manager) => {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [ownerId],
        );
        const active = await manager.findOneBy(ScanRun, {
          repositoryId,
          status: In([...ACTIVE_RUN_STATUSES]),
        });
        if (active) return { run: active, created: false };

        const activeCount = await manager.countBy(ScanRun, {
          ownerId,
          status: In([...ACTIVE_RUN_STATUSES]),
        });
        if (activeCount >= maxActive) {
          throw new ConflictException(
            `You can run at most ${maxActive} scans at the same time. Wait for one to finish.`,
          );
        }
        const run = await manager.save(
          manager.create(ScanRun, { repositoryId, ownerId, status: 'queued' }),
        );
        await manager.insert(
          ScanStage,
          STAGE_NAMES.map((name, position) => ({
            runId: run.id,
            name,
            position,
          })),
        );
        return { run, created: true };
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        const active = await this.runs.findOneByOrFail({
          repositoryId,
          status: In([...ACTIVE_RUN_STATUSES]),
        });
        return { run: active, created: false };
      }
      throw error;
    }

    if (result.created) {
      try {
        await enqueuePrepare(this.scanQueue, result.run.id);
      } catch (error) {
        this.logger.error('Enqueue failed, the sweeper will retry', {
          runId: result.run.id,
          error: String(error),
        });
      }
    }
    return result;
  }
}
