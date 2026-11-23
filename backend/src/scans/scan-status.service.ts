import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as OrmRepository } from 'typeorm';
import { RepositoriesService } from '../repositories/repositories.service.js';
import { Repository } from '../repositories/repository.entity.js';
import { repositoryView } from '../repositories/repository-view.js';
import { ScanRun } from './scan-run.entity.js';
import { ScanStage } from './scan-stage.entity.js';
import { runListItemView, statusView, type StatusView } from './scan-views.js';
import { ScannerRun } from './scanner-run.entity.js';

@Injectable()
export class ScanStatusService {
  constructor(
    @InjectRepository(ScanRun) private readonly runs: OrmRepository<ScanRun>,
    @InjectRepository(ScanStage)
    private readonly stages: OrmRepository<ScanStage>,
    @InjectRepository(ScannerRun)
    private readonly scannerRuns: OrmRepository<ScannerRun>,
    @InjectRepository(Repository)
    private readonly repositoryRows: OrmRepository<Repository>,
    private readonly repositories: RepositoriesService,
  ) {}

  async getOwnedRun(ownerId: string, runId: string): Promise<ScanRun> {
    const run = await this.runs.findOneBy({ id: runId, ownerId });
    if (!run) throw new NotFoundException('Scan not found');
    return run;
  }

  async getStatus(ownerId: string, runId: string): Promise<StatusView> {
    return this.toStatusView(await this.getOwnedRun(ownerId, runId));
  }

  async toStatusView(run: ScanRun): Promise<StatusView> {
    const [repository, stages, scanners] = await Promise.all([
      this.repositoryRows.findOneByOrFail({ id: run.repositoryId }),
      this.stages.findBy({ runId: run.id }),
      this.scannerRuns.findBy({ runId: run.id }),
    ]);
    return statusView(run, repository, stages, scanners);
  }

  async listRepositoriesWithLatestRun(ownerId: string) {
    const [repositories, latest] = await Promise.all([
      this.repositories.list(ownerId),
      this.runs
        .createQueryBuilder('run')
        .distinctOn(['run.repositoryId'])
        .where('run.ownerId = :ownerId', { ownerId })
        .orderBy('run.repositoryId')
        .addOrderBy('run.createdAt', 'DESC')
        .addOrderBy('run.id', 'DESC')
        .getMany(),
    ]);
    const latestByRepository = new Map(latest.map((r) => [r.repositoryId, r]));
    return repositories.map((repository) => {
      const run = latestByRepository.get(repository.id);
      return {
        ...repositoryView(repository),
        latestRun: run
          ? {
              id: run.id,
              status: run.status,
              createdAt: run.createdAt,
              finishedAt: run.finishedAt,
            }
          : null,
      };
    });
  }

  async listForRepository(ownerId: string, repositoryId: string) {
    await this.repositories.getOwned(ownerId, repositoryId);
    const runs = await this.runs.find({
      where: { ownerId, repositoryId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 20,
    });
    return runs.map(runListItemView);
  }
}
