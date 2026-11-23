import {
  Global,
  Inject,
  Injectable,
  Logger,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConfig } from '../config/namespaces.js';

export const REDIS = Symbol('REDIS');

const logger = new Logger('Redis');

/**
 * ioredis reconnects on its own; without an 'error' listener every failed
 * attempt (for example while Redis restarts) is printed as an unhandled event.
 */
export function logRedisErrors(client: Redis): Redis {
  return client.on('error', (error: Error) =>
    logger.warn(`Redis connection error: ${error.message}`),
  );
}

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
        logRedisErrors(new Redis(redis.url)),
    },
    RedisShutdown,
  ],
  exports: [REDIS],
})
export class RedisModule {}
