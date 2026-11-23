import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    hookTimeout: 30_000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgres://postgres:test@127.0.0.1:55432/security_reviewer_test',
      REDIS_URL: process.env.TEST_REDIS_URL ?? 'redis://127.0.0.1:56379',
      JWT_SECRET: 'e2e-test-jwt-secret-0123456789abcdef',
      FINGERPRINT_KEY: 'e2e-test-fingerprint-key-0123456789ab',
      S3_ENDPOINT: 'http://127.0.0.1:9',
      S3_ACCESS_KEY: 'e2e-test-access',
      S3_SECRET_KEY: 'e2e-test-secret-key',
    },
  },
});
