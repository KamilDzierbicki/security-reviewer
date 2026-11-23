import { Injectable } from '@nestjs/common';
import {
  AuthenticationRegistry,
  JwtBearerProvider,
  type JwtClaims,
} from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';
import type { AuthUser } from './auth-user.js';

@Injectable()
export class JwtAuth extends JwtBearerProvider<AuthUser> {
  constructor(
    private readonly users: UsersService,
    registry: AuthenticationRegistry,
  ) {
    super();
    registry.registerProvider(this);
  }

  protected validate({ sub }: JwtClaims): Promise<AuthUser | null> | null {
    return sub ? this.users.findById(sub) : null;
  }
}
