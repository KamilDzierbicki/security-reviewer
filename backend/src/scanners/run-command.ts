import { execFile } from 'node:child_process';
import { basename } from 'node:path';

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface CommandOptions {
  cwd?: string;
  timeoutMs: number;
  okExitCodes?: number[];
  env?: Record<string, string>;
}

export class CommandError extends Error {}

const MAX_OUTPUT_BYTES = 64 * 1024 * 1024;

export function runCommand(
  command: string,
  args: string[],
  options: CommandOptions,
): Promise<CommandResult> {
  const okExitCodes = options.okExitCodes ?? [0];
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        killSignal: 'SIGKILL',
        maxBuffer: MAX_OUTPUT_BYTES,
        env: {
          PATH: process.env.PATH ?? '/usr/local/bin:/usr/bin:/bin',
          LANG: 'C.UTF-8',
          ...options.env,
        },
      },
      (error, stdout, stderr) => {
        const exitCode =
          error && typeof error.code === 'number' ? error.code : error ? -1 : 0;
        const name = basename(command);
        if (error && error.killed) {
          reject(
            new CommandError(
              `${name} timed out after ${options.timeoutMs / 1000}s`,
            ),
          );
        } else if (!okExitCodes.includes(exitCode)) {
          reject(new CommandError(`${name} exited with code ${exitCode}`));
        } else {
          resolve({ stdout, stderr, exitCode });
        }
      },
    );
  });
}
