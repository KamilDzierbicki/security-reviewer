import { registerAs } from '@nestjs/config';
import { envSchema } from './env.js';

const env = () => envSchema.parse(process.env);

export const appConfig = registerAs('app', () => {
  const e = env();
  return {
    nodeEnv: e.NODE_ENV,
    port: e.PORT,
    trustProxyHops: e.TRUST_PROXY_HOPS,
  };
});

export const databaseConfig = registerAs('database', () => ({
  url: env().DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  url: env().REDIS_URL,
}));

export const authConfig = registerAs('auth', () => {
  const e = env();
  return { jwtSecret: e.JWT_SECRET, jwtTtlSeconds: e.JWT_TTL_SECONDS };
});

export const storageConfig = registerAs('storage', () => {
  const e = env();
  return {
    endpoint: e.S3_ENDPOINT,
    region: e.S3_REGION,
    accessKey: e.S3_ACCESS_KEY,
    secretKey: e.S3_SECRET_KEY,
    bucket: e.S3_BUCKET,
  };
});

export const scanConfig = registerAs('scan', () => {
  const e = env();
  return {
    maxRepoSizeMb: e.MAX_REPO_SIZE_MB,
    maxActiveRunsPerUser: e.MAX_ACTIVE_RUNS_PER_USER,
    workdir: e.SCAN_WORKDIR,
    concurrency: e.SCAN_CONCURRENCY,
  };
});

export const scannersConfig = registerAs('scanners', () => {
  const e = env();
  return {
    osvPath: e.OSV_SCANNER_PATH,
    osvConfig: e.OSV_SCANNER_CONFIG,
    gitleaksPath: e.GITLEAKS_PATH,
    gitleaksConfig: e.GITLEAKS_CONFIG,
    fingerprintKey: e.FINGERPRINT_KEY,
  };
});

export const llmConfig = registerAs('llm', () => {
  const e = env();
  return { anthropicApiKey: e.ANTHROPIC_API_KEY, model: e.ANTHROPIC_MODEL };
});

export const githubConfig = registerAs('github', () => ({
  token: env().GITHUB_TOKEN,
}));

export const CONFIG_NAMESPACES = [
  appConfig,
  databaseConfig,
  redisConfig,
  authConfig,
  storageConfig,
  scanConfig,
  scannersConfig,
  llmConfig,
  githubConfig,
];
