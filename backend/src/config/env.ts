import { z } from 'zod';

const secret = z.string().min(32, 'must be at least 32 characters');

const LOCAL_ONLY_PREFIX = 'local-only-';
const LOCAL_ONLY_SECRETS = [
  'JWT_SECRET',
  'FINGERPRINT_KEY',
  'S3_SECRET_KEY',
] as const;

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(0),
    DATABASE_URL: z.url(),
    REDIS_URL: z.url(),
    JWT_SECRET: secret,
    JWT_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(8 * 3600),
    FINGERPRINT_KEY: secret,
    S3_ENDPOINT: z.url(),
    S3_REGION: z.string().default('us-east-1'),
    S3_ACCESS_KEY: z.string().min(8),
    S3_SECRET_KEY: z.string().min(16),
    S3_BUCKET: z.string().default('scan-artifacts'),
    ANTHROPIC_API_KEY: z.string().optional(),
    ANTHROPIC_MODEL: z.string().default('claude-sonnet-5-5'),
    GITHUB_TOKEN: z.string().optional(),
    MAX_REPO_SIZE_MB: z.coerce.number().int().positive().default(200),
    MAX_ACTIVE_RUNS_PER_USER: z.coerce.number().int().positive().default(2),
    SCAN_WORKDIR: z.string().optional(),
    SCAN_CONCURRENCY: z.coerce.number().int().positive().default(2),
    OSV_SCANNER_PATH: z.string().default('osv-scanner'),
    OSV_SCANNER_CONFIG: z.string().default('/opt/scanners/osv-scanner.toml'),
    GITLEAKS_PATH: z.string().default('gitleaks'),
    GITLEAKS_CONFIG: z.string().default('/opt/scanners/gitleaks.toml'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    for (const key of LOCAL_ONLY_SECRETS) {
      if (env[key].startsWith(LOCAL_ONLY_PREFIX)) {
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: `${key} is the local default from docker-compose.yml; set a real secret for production`,
        });
      }
    }
  });
