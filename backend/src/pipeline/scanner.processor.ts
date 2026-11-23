import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, type OnApplicationBootstrap } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { Job } from 'bullmq';
import { scanConfig } from '../config/namespaces.js';
import { SCANNER_QUEUE, type ScannerJobData } from './queues.js';
import { ScannerJobService } from './scanner-job.service.js';

@Processor(SCANNER_QUEUE)
export class ScannerProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly scannerJobs: ScannerJobService,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
  ) {
    super();
  }

  onApplicationBootstrap() {
    this.worker.concurrency = this.scan.concurrency;
  }

  process(job: Job<ScannerJobData>): Promise<void> {
    return this.scannerJobs.run(job.data);
  }
}
