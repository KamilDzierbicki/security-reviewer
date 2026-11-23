import type { ConfigType } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { appConfig } from './config/namespaces.js';

export function configureApp(app: NestExpressApplication): void {
  app.setGlobalPrefix('api', { exclude: ['health', 'ready'] });
  const { trustProxyHops } = app.get<ConfigType<typeof appConfig>>(
    appConfig.KEY,
  );
  app.set('trust proxy', trustProxyHops);
  app.enableShutdownHooks();
}
