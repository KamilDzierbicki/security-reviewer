import {
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as tar from 'tar';
import { ScanFailure } from './scan-failure.js';
import { extractArchive, isSafeEntry, packDirectory } from './workspace.js';

describe('snapshot packing and extraction', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'workspace-spec-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('drops symlinks when packing, so a planted link never reaches a scanner', async () => {
    const source = join(dir, 'src');
    await mkdir(source);
    await writeFile(join(source, 'index.js'), 'console.log(1)');
    await symlink('/etc/passwd', join(source, 'passwd'));
    const archive = join(dir, 'snapshot.tar.gz');
    await packDirectory(source, archive);

    const out = join(dir, 'out');
    await mkdir(out);
    await extractArchive(archive, out, 1024 * 1024);
    expect(await readdir(out)).toEqual(['index.js']);
  });

  it('rejects an archive with a path traversal entry before writing anything', async () => {
    const staging = join(dir, 'staging');
    await mkdir(join(staging, 'a'), { recursive: true });
    await writeFile(join(dir, 'evil.txt'), 'pwned');
    const archive = join(dir, 'evil.tar.gz');
    await tar.c(
      { gzip: true, file: archive, cwd: staging, preservePaths: true },
      ['a', '../evil.txt'],
    );
    const out = join(dir, 'out');
    await mkdir(out);
    await expect(extractArchive(archive, out, 1024 * 1024)).rejects.toThrow(
      ScanFailure,
    );
    expect(await readdir(out)).toEqual([]);
  });

  it('accepts only plain relative files and directories', () => {
    expect(isSafeEntry('./src/index.js', 'File')).toBe(true);
    expect(isSafeEntry('./src', 'Directory')).toBe(true);
    expect(isSafeEntry('../etc/passwd', 'File')).toBe(false);
    expect(isSafeEntry('src/../../x', 'File')).toBe(false);
    expect(isSafeEntry('/etc/passwd', 'File')).toBe(false);
    expect(isSafeEntry('link', 'SymbolicLink')).toBe(false);
    expect(isSafeEntry('hard', 'Link')).toBe(false);
    expect(isSafeEntry('dev', 'CharacterDevice')).toBe(false);
  });
});
