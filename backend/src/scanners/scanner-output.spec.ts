import { CommandError, runCommand } from './run-command.js';
import { canonicalId } from './osv-output.js';

describe('canonicalId', () => {
  it('stays the same when OSV adds aliases to the group', () => {
    const before = canonicalId(['GHSA-29mw-wpgm-hmr9']);
    expect(canonicalId(['PYSEC-2020-1', 'GHSA-29mw-wpgm-hmr9'])).toBe(before);
    expect(canonicalId(['CVE-2020-28500', 'GHSA-29mw-wpgm-hmr9'])).toBe(before);
  });

  it('falls back to a CVE id, then to the lowest id', () => {
    expect(canonicalId(['PYSEC-2021-9', 'CVE-2021-1'])).toBe('CVE-2021-1');
    expect(canonicalId(['RUSTSEC-2', 'RUSTSEC-1'])).toBe('RUSTSEC-1');
  });
});

describe('runCommand errors', () => {
  it('reports the exit code without the command output', async () => {
    const secret = 'AKIAZ7Q3XG4KP2LMRT5W';
    const failing = runCommand(
      process.execPath,
      [
        '-e',
        `console.log('${secret}'); console.error('${secret}'); process.exit(3)`,
      ],
      { timeoutMs: 10_000 },
    );
    await expect(failing).rejects.toThrow(CommandError);
    await expect(failing).rejects.toThrow(/exited with code 3$/);
    await failing.catch((error: Error) => {
      expect(error.message).not.toContain(secret);
    });
  });

  it('accepts exit codes that mean "found something"', async () => {
    const result = await runCommand(
      process.execPath,
      ['-e', 'process.exit(1)'],
      {
        timeoutMs: 10_000,
        okExitCodes: [0, 1],
      },
    );
    expect(result.exitCode).toBe(1);
  });

  it('kills a command that runs past its timeout', async () => {
    await expect(
      runCommand(process.execPath, ['-e', 'setTimeout(() => {}, 10_000)'], {
        timeoutMs: 200,
      }),
    ).rejects.toThrow(/timed out/);
  });
});
