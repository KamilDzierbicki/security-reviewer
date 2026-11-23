import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { UnrecoverableError, type Job } from 'bullmq';
import { scanConfig } from '../config/namespaces.js';
import { AnalyzeService } from './analyze.service.js';
import { PrepareService } from './prepare.service.js';
import {
  SCAN_QUEUE,
  type AnalyzeJobData,
  type PrepareJobData,
} from './queues.js';
import { RunStateService } from './run-state.service.js';
import { ScanFailure } from './scan-failure.js';

type ScanJob = Job<PrepareJobData | AnalyzeJobData>;

@Processor(SCAN_QUEUE)
export class ScanProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  private readonly logger = new Logger(ScanProcessor.name);

  constructor(
    private readonly prepareService: PrepareService,
    private readonly analyzeService: AnalyzeService,
    private readonly runState: RunStateService,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
  ) {
    super();
  }

  onApplicationBootstrap() {
    this.worker.concurrency = this.scan.concurrency;
  }

  async process(job: ScanJob): Promise<void> {
    switch (job.name) {
      case 'prepare':
        return this.prepareService.prepare(job.data.runId);
      case 'analyze':
        return this.analyzeService.analyze(job.data as AnalyzeJobData);
      default:
        throw new UnrecoverableError(`Unknown job ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: ScanJob | undefined, error: Error) {
    if (!job) return;
    const final =
      error instanceof UnrecoverableError ||
      job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.warn('Scan job failed', {
      job: job.name,
      runId: job.data.runId,
      attempt: job.attemptsMade,
      error: error.message,
    });
    if (!final) return;
    const reason =
      error instanceof ScanFailure
        ? error.message
        : job.name === 'prepare'
          ? 'Could not download the repository snapshot. Try again later.'
          : 'Could not finish analyzing the results. Try again later.';
    const attempt = 'attempt' in job.data ? job.data.attempt : null;
    try {
      await this.runState.fail(job.data.runId, attempt, reason);
    } catch (failError) {
      this.logger.error('Could not mark the run as failed', {
        runId: job.data.runId,
        error: String(failError),
      });
    }
  }
}
