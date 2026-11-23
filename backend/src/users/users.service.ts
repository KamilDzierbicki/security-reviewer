import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as OrmRepository } from 'typeorm';
import type { AuthUser } from '../auth/auth-user.js';
import { isUniqueViolation } from '../database/postgres-errors.js';
import { User } from './user.entity.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: OrmRepository<User>,
  ) {}

  async findById(id: string): Promise<AuthUser | null> {
    const user = await this.users.findOneBy({ id });
    return user && toAuthUser(user);
  }

  async findCredentials(
    email: string,
  ): Promise<{ user: AuthUser; passwordHash: string } | null> {
    const user = await this.users.findOneBy({ email: email.toLowerCase() });
    return user && { user: toAuthUser(user), passwordHash: user.passwordHash };
  }

  async create(email: string, passwordHash: string): Promise<AuthUser> {
    try {
      const user = await this.users.save(
        this.users.create({ email: email.toLowerCase(), passwordHash }),
      );
      return toAuthUser(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw error;
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.users.update({ id }, { passwordHash });
  }
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email };
}
