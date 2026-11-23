import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { githubConfig } from '../config/namespaces.js';
import type { GitHubRepoRef } from './github-url.js';

export interface GitHubRepository {
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  sizeKb: number;
}

export class GitHubLookupError extends Error {
  constructor(
    message: string,
    readonly status: 'not_found' | 'unavailable',
  ) {
    super(message);
  }
}

@Injectable()
export class GitHubClient {
  constructor(
    @Inject(githubConfig.KEY)
    private readonly github: ConfigType<typeof githubConfig>,
  ) {}

  async getRepository(ref: GitHubRepoRef): Promise<GitHubRepository> {
    const token = this.github.token;
    const url = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.name)}`;
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'security-reviewer',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
    } catch {
      throw new GitHubLookupError(
        'GitHub is not reachable right now',
        'unavailable',
      );
    }
    if (response.status === 404) {
      throw new GitHubLookupError(
        'Repository not found. Only public repositories are supported.',
        'not_found',
      );
    }
    if (!response.ok) {
      throw new GitHubLookupError(
        `GitHub returned ${response.status}; try again later`,
        'unavailable',
      );
    }
    const body = (await response.json()) as {
      full_name: string;
      default_branch: string;
      private: boolean;
      size: number;
    };
    return {
      fullName: body.full_name,
      defaultBranch: body.default_branch,
      isPrivate: body.private,
      sizeKb: body.size,
    };
  }
}
