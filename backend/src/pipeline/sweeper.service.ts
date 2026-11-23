import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository as OrmRepository } from 'typeorm';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ACTIVE_RUN_STATUSES } from '../scans/scan.types.js';
import { ArtifactStorageService } from '../storage/artifact-storage.service.js';
import { analyzeJobId, enqueuePrepare, SCAN_QUEUE } from './queues.js';
import { RunStateService } from './run-state.service.js';

const STUCK_QUEUED_MS = 5 * 60_000;
const QUIET_RUNNING_MS = 10 * 60_000;
const ALIVE_STATES = new Set([
  'waiting',
  'active',
  'delayed',
  'prioritized',
  'waiting-children',
]);

@Injectable()
export class SweeperService {
  private readonly logger = new Logger(SweeperService.name);

  constructor(
    @InjectRepository(ScanRun) private readonly runs: OrmRepository<ScanRun>,
    private readonly runState: RunStateService,
    private readonly storage: ArtifactStorageService,
    @InjectQueue(SCAN_QUEUE) private readonly scanQueue: Queue,
  ) {}

  async sweep(now = new Date()): Promise<void> {
    await this.requeueStuckQueued(now);
    await this.failAbandonedRuns(now);
    await this.deleteOrphanedArtifacts();
  }

  private async requeueStuckQueued(now: Date): Promise<void> {
    const stuck = await this.runs.findBy({
      status: 'queued',
      createdAt: LessThan(new Date(now.getTime() - STUCK_QUEUED_MS)),
    });
    for (const run of stuck) {
      const job = (await this.scanQueue.getJob(run.id)) as Job | undefined;
      const state = job ? await job.getState() : 'missing';
      if (ALIVE_STATES.has(state)) continue;
      this.logger.warn('Re-enqueueing run', {
        runId: run.id,
        prepareJob: state,
      });
      if (job && state === 'failed') {
        await job.retry('failed');
      } else {
        if (job) await job.remove();
        await enqueuePrepare(this.scanQueue, run.id);
      }
    }
  }

  private async failAbandonedRuns(now: Date): Promise<void> {
    const stuck = await this.runs.findBy({
      status: 'running',
      updatedAt: LessThan(new Date(now.getTime() - QUIET_RUNNING_MS)),
    });
    for (const run of stuck) {
      const jobs = await Promise.all([
        this.scanQueue.getJob(run.id),
        this.scanQueue.getJob(analyzeJobId(run.id, run.attempt)),
      ]);
      const states = await Promise.all(
        jobs.map((job) => (job ? job.getState() : Promise.resolve('missing'))),
      );
      if (states.some((state) => ALIVE_STATES.has(state))) continue;
      this.logger.warn('Failing run with no live jobs', {
        runId: run.id,
        jobStates: states,
      });
      await this.runState.fail(
        run.id,
        run.attempt,
        'The scan stopped unexpectedly. Start it again.',
      );
    }
  }

  private async deleteOrphanedArtifacts(): Promise<void> {
    const artifacts = await this.storage.list();
    if (artifacts.length === 0) return;
    const runIds = [
      ...new Set(artifacts.map((a) => this.storage.runIdOf(a.key))),
    ].filter(isUuid);
    const active = await this.runs.find({
      select: { id: true },
      where: { id: In(runIds), status: In([...ACTIVE_RUN_STATUSES]) },
    });
    const activeIds = new Set(active.map((r) => r.id));
    for (const artifact of artifacts) {
      if (!activeIds.has(this.storage.runIdOf(artifact.key))) {
        await this.storage.delete(artifact.key);
      }
    }
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    value,
  );
}
