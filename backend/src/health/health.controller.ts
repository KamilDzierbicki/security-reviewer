import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { RedisHealthIndicator } from './redis.health.js';

@Public()
@Controller()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly redis: RedisHealthIndicator,
  ) {}

  @Get('health')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.database.pingCheck('database').withTimeout('1s'),
      () => this.redis.pingCheck('redis'),
    ]);
  }
}
