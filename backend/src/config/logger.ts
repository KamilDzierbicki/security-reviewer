import { ConsoleLogger } from '@nestjs/common';

export function jsonLogger(): ConsoleLogger {
  return new ConsoleLogger({
    json: true,
    logLevels: ['log', 'warn', 'error', 'fatal'],
    redact: ['password', 'authorization', 'accessToken'],
  });
}
