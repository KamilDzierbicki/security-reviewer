import { Inject, Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { Finding } from '../risk/finding.entity.js';
import { SCANNERS, type Scanner } from '../scanners/scanner.interface.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ScanStage } from '../scans/scan-stage.entity.js';
import { ScannerRun } from '../scans/scanner-run.entity.js';
import type { StageName, StageStatus } from '../scans/scan.types.js';
import { ProgressPublisher } from './progress.publisher.js';

export interface ActiveAttempt {
  run: ScanRun;
  attempt: number;
}

@Injectable()
export class RunStateService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly progress: ProgressPublisher,
    @Inject(SCANNERS) private readonly scanners: Scanner[],
  ) {}

  async begin(runId: string): Promise<ActiveAttempt | null> {
    const result = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<{ attempt: number }[][]>(
        `UPDATE scan_runs
           SET status = 'running', attempt = attempt + 1, error = NULL,
               started_at = COALESCE(started_at, now()), updated_at = now()
         WHERE id = $1 AND status IN ('queued', 'running')
         RETURNING attempt`,
        [runId],
      );
      const attempt = rows[0]?.[0]?.attempt;
      if (attempt === undefined) return null;

      await manager.delete(Finding, { runId });
      await manager.update(
        ScanStage,
        { runId },
        { status: 'pending', error: null, startedAt: null, finishedAt: null },
      );
      await manager
        .createQueryBuilder()
        .insert()
        .into(ScannerRun)
        .values(
          this.scanners.map((s) => ({
            runId,
            scanner: s.name,
            kind: s.kind,
          })),
        )
        .orUpdate(
          [
            'kind',
            'status',
            'finding_count',
            'error',
            'started_at',
            'finished_at',
          ],
          ['run_id', 'scanner'],
        )
        .execute();
      const run = await manager.findOneByOrFail(ScanRun, { id: runId });
      return { run, attempt };
    });
    await this.progress.publish(runId);
    return result;
  }

  async withAttempt<T>(
    runId: string,
    attempt: number,
    work: (manager: EntityManager, run: ScanRun) => Promise<T>,
  ): Promise<{ value: T } | null> {
    const result = await this.dataSource.transaction(async (manager) => {
      const run = await manager
        .createQueryBuilder(ScanRun, 'run')
        .setLock('pessimistic_write')
        .where('run.id = :runId', { runId })
        .andWhere('run.attempt = :attempt', { attempt })
        .andWhere(`run.status = 'running'`)
        .getOne();
      if (!run) return null;
      const value = await work(manager, run);
      await manager.update(ScanRun, { id: runId }, { updatedAt: new Date() });
      return { value };
    });
    await this.progress.publish(runId);
    return result;
  }

  setStage(
    runId: string,
    attempt: number,
    name: StageName,
    status: StageStatus,
    error: string | null = null,
  ) {
    const now = new Date();
    return this.withAttempt(runId, attempt, (manager) =>
      manager.update(
        ScanStage,
        { runId, name },
        {
          status,
          error,
          ...(status === 'running' ? { startedAt: now } : { finishedAt: now }),
        },
      ),
    );
  }

  async fail(
    runId: string,
    attempt: number | null,
    reason: string,
  ): Promise<boolean> {
    const changed = await this.dataSource.transaction(async (manager) => {
      const params: unknown[] = [runId, reason];
      let attemptClause = '';
      if (attempt !== null) {
        params.push(attempt);
        attemptClause = 'AND attempt = $3';
      }
      const rows = await manager.query<{ id: string }[][]>(
        `UPDATE scan_runs
           SET status = 'failed', error = $2, finished_at = now(), updated_at = now()
         WHERE id = $1 AND status IN ('queued', 'running') ${attemptClause}
         RETURNING id`,
        params,
      );
      if (!rows[0]?.length) return false;
      await manager.query(
        `UPDATE scan_stages
           SET status = CASE WHEN status = 'running' THEN 'failed' ELSE 'skipped' END,
               finished_at = now()
         WHERE run_id = $1 AND status IN ('pending', 'running')`,
        [runId],
      );
      await manager.query(
        `UPDATE scanner_runs SET status = 'failed', finished_at = now(),
               error = COALESCE(error, 'Not run: the scan stopped')
         WHERE run_id = $1 AND status IN ('pending', 'running')`,
        [runId],
      );
      return true;
    });
    await this.progress.publish(runId);
    return changed;
  }
}
