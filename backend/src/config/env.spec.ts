import { envSchema } from './env.js';

const base = {
  DATABASE_URL:
    'postgres://security_reviewer:pw@postgres:5432/security_reviewer',
  REDIS_URL: 'redis://redis:6379',
  S3_ENDPOINT: 'http://rustfs:9000',
  S3_ACCESS_KEY: 'access-key-1',
  JWT_SECRET: 'local-only-jwt-secret-5b2e9d7c41a84f0e9c3b',
  FINGERPRINT_KEY: 'local-only-fingerprint-key-a71c4e09d2b3',
  S3_SECRET_KEY: 'local-only-rustfs-secret-c9e2a5b8f1',
};

describe('envSchema', () => {
  it('accepts the docker-compose defaults outside production', () => {
    expect(
      envSchema.safeParse({ ...base, NODE_ENV: 'development' }).success,
    ).toBe(true);
  });

  it('refuses to start production with the docker-compose defaults', () => {
    const result = envSchema.safeParse({ ...base, NODE_ENV: 'production' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0]).sort()).toEqual([
      'FINGERPRINT_KEY',
      'JWT_SECRET',
      'S3_SECRET_KEY',
    ]);
  });

  it('starts production with real secrets', () => {
    const result = envSchema.safeParse({
      ...base,
      NODE_ENV: 'production',
      JWT_SECRET: 'a'.repeat(40),
      FINGERPRINT_KEY: 'b'.repeat(40),
      S3_SECRET_KEY: 'c'.repeat(20),
    });
    expect(result.success).toBe(true);
  });
});
