import { lstat, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, normalize } from 'node:path';
import * as tar from 'tar';
import { runCommand } from '../scanners/run-command.js';
import { ScanFailure } from './scan-failure.js';

export interface Workspace {
  dir: string;
  sourceDir: string;
  cleanup(): Promise<void>;
}

export async function createWorkspace(base?: string): Promise<Workspace> {
  const root = base ?? tmpdir();
  await mkdir(root, { recursive: true });
  const dir = await mkdtemp(join(root, 'scan-'));
  const sourceDir = join(dir, 'src');
  await mkdir(sourceDir);
  return {
    dir,
    sourceDir,
    cleanup: () => rm(dir, { recursive: true, force: true }),
  };
}

function gitEnv(home: string): Record<string, string> {
  return {
    HOME: home,
    GIT_ALLOW_PROTOCOL: 'https',
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_ASKPASS: '/bin/false',
  };
}

const GIT_SAFE_FLAGS = [
  '-c',
  'http.followRedirects=false',
  '-c',
  'core.hooksPath=/dev/null',
  '-c',
  'protocol.file.allow=never',
  '-c',
  'submodule.recurse=false',
];

export function cloneUrl(fullName: string): string {
  return `https://github.com/${fullName}.git`;
}

export async function resolveHeadCommit(
  fullName: string,
  home: string,
): Promise<string> {
  try {
    const { stdout } = await runCommand(
      'git',
      [...GIT_SAFE_FLAGS, 'ls-remote', cloneUrl(fullName), 'HEAD'],
      { timeoutMs: 30_000, env: gitEnv(home) },
    );
    const sha = stdout.split(/\s/)[0];
    if (!/^[0-9a-f]{40}$/.test(sha)) {
      throw new ScanFailure('The repository has no commits to scan.');
    }
    return sha;
  } catch (error) {
    if (error instanceof ScanFailure) throw error;
    throw new ScanFailure(
      'Could not reach the repository. It may have been deleted, renamed or made private.',
    );
  }
}

export async function fetchCommit(
  workspace: Workspace,
  fullName: string,
  sha: string,
): Promise<void> {
  const env = gitEnv(workspace.dir);
  const opts = { cwd: workspace.sourceDir, timeoutMs: 120_000, env };
  await runCommand('git', [...GIT_SAFE_FLAGS, 'init', '-q'], opts);
  await runCommand(
    'git',
    [
      ...GIT_SAFE_FLAGS,
      'fetch',
      '--depth',
      '1',
      '--no-tags',
      '--no-recurse-submodules',
      cloneUrl(fullName),
      sha,
    ],
    opts,
  );
  await runCommand(
    'git',
    [
      ...GIT_SAFE_FLAGS,
      'checkout',
      '-q',
      '--no-recurse-submodules',
      'FETCH_HEAD',
    ],
    opts,
  );
  await rm(join(workspace.sourceDir, '.git'), { recursive: true, force: true });
}

export async function assertSizeWithin(dir: string, maxBytes: number) {
  let total = 0;
  const walk = async (path: string): Promise<void> => {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const full = join(path, entry.name);
      if (entry.isDirectory()) await walk(full);
      else if (entry.isFile()) {
        total += (await lstat(full)).size;
        if (total > maxBytes) {
          throw new ScanFailure(
            `The repository is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit.`,
          );
        }
      }
    }
  };
  await walk(dir);
}

export async function packDirectory(dir: string, file: string): Promise<void> {
  await tar.c(
    {
      gzip: true,
      file,
      cwd: dir,
      portable: true,
      filter: (_path, stat) =>
        'isFile' in stat && (stat.isFile() || stat.isDirectory()),
    },
    ['.'],
  );
}

export function isSafeEntry(path: string, type: string): boolean {
  if (type !== 'File' && type !== 'Directory') return false;
  if (isAbsolute(path) || path.includes('\\')) return false;
  return !normalize(path).split('/').includes('..');
}

export async function extractArchive(
  file: string,
  destDir: string,
  maxBytes: number,
): Promise<void> {
  let total = 0;
  const unsafe: string[] = [];
  await tar.t({
    file,
    onReadEntry: (entry) => {
      total += entry.size ?? 0;
      if (!isSafeEntry(entry.path, entry.type)) {
        unsafe.push(`${entry.type} ${entry.path}`);
      }
    },
  });
  if (unsafe.length > 0) {
    throw new ScanFailure(`Rejected unsafe archive entry: ${unsafe[0]}`);
  }
  if (total > maxBytes) {
    throw new ScanFailure('The snapshot is larger than the size limit.');
  }
  await tar.x({
    file,
    cwd: destDir,
    strict: true,
    preserveOwner: false,
    filter: (path, entry) => 'type' in entry && isSafeEntry(path, entry.type),
  });
}
