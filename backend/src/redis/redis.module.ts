import {
  Global,
  Inject,
  Injectable,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/namespaces.js';

export const REDIS = Symbol('REDIS');

@Injectable()
class RedisShutdown implements OnApplicationShutdown {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) =>
        new Redis(redis.url),
    },
    RedisShutdown,
  ],
  exports: [REDIS],
})
export class RedisModule {}
