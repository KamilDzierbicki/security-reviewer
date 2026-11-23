import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as OrmRepository } from 'typeorm';
import { scanConfig } from '../config/namespaces.js';
import { GitHubClient, GitHubLookupError } from './github.client.js';
import { InvalidRepositoryUrl, parseGitHubRepoUrl } from './github-url.js';
import { Repository } from './repository.entity.js';

@Injectable()
export class RepositoriesService {
  constructor(
    @InjectRepository(Repository)
    private readonly repositories: OrmRepository<Repository>,
    private readonly github: GitHubClient,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
  ) {}

  async add(ownerId: string, url: string): Promise<Repository> {
    let ref;
    try {
      ref = parseGitHubRepoUrl(url);
    } catch (error) {
      if (error instanceof InvalidRepositoryUrl) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    let info;
    try {
      info = await this.github.getRepository(ref);
    } catch (error) {
      if (error instanceof GitHubLookupError) {
        throw error.status === 'not_found'
          ? new BadRequestException(error.message)
          : new ServiceUnavailableException(error.message);
      }
      throw error;
    }
    if (info.isPrivate) {
      throw new BadRequestException('Only public repositories are supported.');
    }
    const maxMb = this.scan.maxRepoSizeMb;
    if (info.sizeKb > maxMb * 1024) {
      throw new BadRequestException(
        `The repository is larger than the ${maxMb} MB limit.`,
      );
    }

    await this.repositories
      .createQueryBuilder()
      .insert()
      .values({
        ownerId,
        fullName: info.fullName,
        defaultBranch: info.defaultBranch,
      })
      .orIgnore()
      .execute();
    return this.repositories.findOneByOrFail({
      ownerId,
      fullName: info.fullName,
    });
  }

  list(ownerId: string): Promise<Repository[]> {
    return this.repositories.find({
      where: { ownerId },
      order: { createdAt: 'DESC', id: 'DESC' },
    });
  }

  async getOwned(ownerId: string, id: string): Promise<Repository> {
    const repository = await this.repositories.findOneBy({ id, ownerId });
    if (!repository) throw new NotFoundException('Repository not found');
    return repository;
  }
}
