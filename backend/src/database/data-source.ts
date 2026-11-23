import { DataSource } from 'typeorm';
import { typeOrmOptions } from './typeorm-options.js';

export default new DataSource(
  typeOrmOptions(
    process.env.DATABASE_URL ?? 'postgres://localhost/security_reviewer',
  ),
);
