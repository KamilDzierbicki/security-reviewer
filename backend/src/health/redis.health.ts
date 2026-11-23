import { Inject, Injectable } from '@nestjs/common';
import { HealthIndicatorService } from '@nestjs/terminus';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';

@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly indicators: HealthIndicatorService,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  pingCheck(key: string) {
    return this.indicators
      .check(key)
      .attempt(async () => {
        await this.redis.ping();
      })
      .withTimeout('1s');
  }
}
