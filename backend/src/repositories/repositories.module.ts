import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GitHubClient } from './github.client.js';
import { RepositoriesController } from './repositories.controller.js';
import { RepositoriesService } from './repositories.service.js';
import { Repository } from './repository.entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Repository])],
  controllers: [RepositoriesController],
  providers: [RepositoriesService, GitHubClient],
  exports: [RepositoriesService],
})
export class RepositoriesModule {}
