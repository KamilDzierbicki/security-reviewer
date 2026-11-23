import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  PasswordHasher,
  TokenService,
  type AccessTokenResult,
} from '@nestjs/authentication';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: TokenService,
  ) {}

  async register(email: string, password: string): Promise<AccessTokenResult> {
    const user = await this.users.create(
      email,
      await this.passwordHasher.hash(password),
    );
    return this.tokens.issue(user.id, { method: 'password' });
  }

  async login(email: string, password: string): Promise<AccessTokenResult> {
    const found = await this.users.findCredentials(email);
    const valid = await this.passwordHasher.verify(
      password,
      found?.passwordHash,
    );
    if (!valid || !found) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (this.passwordHasher.needsRehash(found.passwordHash)) {
      await this.users.updatePasswordHash(
        found.user.id,
        await this.passwordHasher.hash(password),
      );
    }
    return this.tokens.issue(found.user.id, { method: 'password' });
  }
}
