import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import { PROGRESS_CHANNEL } from './queues.js';

@Injectable()
export class ProgressPublisher {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async publish(runId: string): Promise<void> {
    await this.redis.publish(PROGRESS_CHANNEL, runId).catch(() => undefined);
  }
}
