import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import type { AuthUser } from '../auth/auth-user.js';
import { CreateRepositoryDto } from './dto/create-repository.dto.js';
import { RepositoriesService } from './repositories.service.js';
import { repositoryView } from './repository-view.js';

@Controller('repositories')
export class RepositoriesController {
  constructor(private readonly repositories: RepositoriesService) {}

  @Post()
  async add(@CurrentUser() user: AuthUser, @Body() dto: CreateRepositoryDto) {
    return repositoryView(await this.repositories.add(user.id, dto.url));
  }

  @Get(':id')
  async get(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return repositoryView(await this.repositories.getOwned(user.id, id));
  }
}
