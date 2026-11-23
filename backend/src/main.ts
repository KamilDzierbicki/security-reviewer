import { Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { jsonLogger } from './config/logger.js';
import { appConfig } from './config/namespaces.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: jsonLogger(),
    forceCloseConnections: true,
  });
  configureApp(app);
  const { port } = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);
  await app.listen(port, '0.0.0.0');
  Logger.log('API listening', { port });
}
await bootstrap();
