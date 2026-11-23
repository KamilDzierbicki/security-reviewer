import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities.js';

export function typeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    entities: ENTITIES,
    migrations: [join(import.meta.dirname, 'migrations', '*.js')],
    synchronize: false,
  };
}
