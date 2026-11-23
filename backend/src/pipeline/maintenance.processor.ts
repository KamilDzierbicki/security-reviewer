import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { ArtifactStorageService } from '../storage/artifact-storage.service.js';
import { MAINTENANCE_QUEUE } from './queues.js';
import { SweeperService } from './sweeper.service.js';

@Processor(MAINTENANCE_QUEUE)
export class MaintenanceProcessor
  extends WorkerHost
  implements OnApplicationBootstrap
{
  constructor(
    private readonly sweeper: SweeperService,
    private readonly storage: ArtifactStorageService,
    @InjectQueue(MAINTENANCE_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onApplicationBootstrap() {
    await this.storage.ensureBucket();
    await this.queue.upsertJobScheduler(
      'sweeper',
      { every: 60_000 },
      { name: 'sweep', opts: { removeOnComplete: true, removeOnFail: 100 } },
    );
  }

  process(): Promise<void> {
    return this.sweeper.sweep();
  }
}
