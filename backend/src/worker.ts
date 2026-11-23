import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { jsonLogger } from './config/logger.js';
import { WorkerModule } from './worker.module.js';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: jsonLogger(),
  });
  app.enableShutdownHooks();
  Logger.log('Worker started');
}
await bootstrap();
