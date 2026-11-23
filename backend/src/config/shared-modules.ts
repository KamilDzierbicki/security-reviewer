import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, type ConfigType } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmOptions } from '../database/typeorm-options.js';
import { RedisModule } from '../redis/redis.module.js';
import { envSchema } from './env.js';
import {
  CONFIG_NAMESPACES,
  databaseConfig,
  redisConfig,
} from './namespaces.js';

export function sharedModules({ runMigrations }: { runMigrations: boolean }) {
  return [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      load: CONFIG_NAMESPACES,
    }),
    TypeOrmModule.forRootAsync({
      inject: [databaseConfig.KEY],
      useFactory: (database: ConfigType<typeof databaseConfig>) => ({
        ...typeOrmOptions(database.url),
        migrationsRun: runMigrations,
      }),
    }),
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => ({
        connection: {
          url: redis.url,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    RedisModule,
  ];
}
