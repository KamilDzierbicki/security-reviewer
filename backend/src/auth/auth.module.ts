import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { UsersModule } from '../users/users.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuth } from './jwt-auth.provider.js';

@Module({
  imports: [
    UsersModule,
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 10 }] }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuth],
})
export class AuthModule {}
