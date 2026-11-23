import type { Repository } from './repository.entity.js';

export function repositoryView(repository: Repository) {
  return {
    id: repository.id,
    fullName: repository.fullName,
    url: `https://github.com/${repository.fullName}`,
    defaultBranch: repository.defaultBranch,
    createdAt: repository.createdAt,
  };
}
