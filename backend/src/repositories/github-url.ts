export interface GitHubRepoRef {
  owner: string;
  name: string;
  fullName: string;
}

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export class InvalidRepositoryUrl extends Error {}

export function parseGitHubRepoUrl(input: string): GitHubRepoRef {
  const raw = input.trim();
  if (raw.length === 0 || raw.length > 300) {
    throw new InvalidRepositoryUrl('Enter a GitHub repository URL');
  }
  if (/\/\.{1,2}(\/|$)/.test(raw)) {
    throw new InvalidRepositoryUrl('Invalid repository path');
  }
  const withScheme = /^github\.com\//i.test(raw) ? `https://${raw}` : raw;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidRepositoryUrl('Not a valid URL');
  }
  if (url.protocol !== 'https:') {
    throw new InvalidRepositoryUrl('Only https URLs are supported');
  }
  if (url.hostname !== 'github.com') {
    throw new InvalidRepositoryUrl(
      'Only github.com repositories are supported',
    );
  }
  if (url.username || url.password || url.port || url.search || url.hash) {
    throw new InvalidRepositoryUrl(
      'The URL must not contain credentials, a port, a query or a fragment',
    );
  }

  const match = /^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(url.pathname);
  if (!match) {
    throw new InvalidRepositoryUrl(
      'Use the repository URL, like https://github.com/owner/name',
    );
  }
  const [, owner, name] = match;
  if (!OWNER.test(owner) || !NAME.test(name) || name === '.' || name === '..') {
    throw new InvalidRepositoryUrl('Invalid owner or repository name');
  }
  return { owner, name, fullName: `${owner}/${name}` };
}
