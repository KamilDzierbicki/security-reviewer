import { Module, ValidationPipe } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/all-exceptions.filter.js';
import { authConfig } from './config/namespaces.js';
import { sharedModules } from './config/shared-modules.js';
import { HealthModule } from './health/health.module.js';
import { RepositoriesModule } from './repositories/repositories.module.js';
import { ScansModule } from './scans/scans.module.js';

@Module({
  imports: [
    ...sharedModules({ runMigrations: true }),
    AuthenticationModule.forRootAsync({
      inject: [authConfig.KEY],
      useFactory: (auth: ConfigType<typeof authConfig>) => ({
        accessToken: {
          key: auth.jwtSecret,
          ttl: auth.jwtTtlSeconds * 1000,
        },
        refreshToken: false,
      }),
    }),
    HealthModule,
    AuthModule,
    RepositoriesModule,
    ScansModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    },
  ],
})
export class AppModule {}
