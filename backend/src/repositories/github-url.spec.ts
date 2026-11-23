import { InvalidRepositoryUrl, parseGitHubRepoUrl } from './github-url.js';

describe('parseGitHubRepoUrl', () => {
  it.each([
    ['https://github.com/OWASP/NodeGoat', 'OWASP/NodeGoat'],
    ['https://github.com/owner/repo.git', 'owner/repo'],
    ['https://github.com/owner/repo/', 'owner/repo'],
    ['github.com/owner/my.repo_name-1', 'owner/my.repo_name-1'],
    ['  https://GITHUB.com/owner/repo  ', 'owner/repo'],
  ])('accepts %s', (input, fullName) => {
    expect(parseGitHubRepoUrl(input).fullName).toBe(fullName);
  });

  it.each([
    'http://github.com/owner/repo',
    'ssh://git@github.com/owner/repo.git',
    'git@github.com:owner/repo.git',
    'file:///etc/passwd',
    'https://github.com.evil.com/owner/repo',
    'https://evil.com/github.com/owner/repo',
    'https://github.com@evil.com/owner/repo',
    'https://user:token@github.com/owner/repo',
    'https://github.com:8080/owner/repo',
    'https://169.254.169.254/latest/meta-data',
    'https://localhost/owner/repo',
    'https://gist.github.com/owner/repo',
    'https://api.github.com/repos/owner/repo',
    'https://github.com/owner/repo?ref=main',
    'https://github.com/owner/repo#readme',
    'https://github.com/owner/repo/tree/main',
    'https://github.com/owner',
    'https://github.com/../../etc/passwd',
    'https://github.com/owner/..',
    'https://github.com/owner/%2e%2e',
    'https://github.com/-owner/repo',
    'https://github.com/owner/--upload-pack=touch',
    'https://github.com\\@evil.com/owner/repo',
    '',
  ])('rejects %s', (input) => {
    expect(() => parseGitHubRepoUrl(input)).toThrow(InvalidRepositoryUrl);
  });
});
