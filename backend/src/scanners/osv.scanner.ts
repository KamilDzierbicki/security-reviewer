import { readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { scannersConfig } from '../config/namespaces.js';
import type { DetectedFinding } from '../risk/risk.types.js';
import { parseOsvOutput, type OsvOutput } from './osv-output.js';
import { runCommand } from './run-command.js';
import type { ScanContext, Scanner } from './scanner.interface.js';

@Injectable()
export class OsvScanner implements Scanner {
  readonly name = 'osv-scanner';
  readonly kind = 'dependency' as const;

  constructor(
    @Inject(scannersConfig.KEY)
    private readonly scanners: ConfigType<typeof scannersConfig>,
  ) {}

  async scan({ rootDir }: ScanContext): Promise<DetectedFinding[]> {
    const configFile = this.scanners.osvConfig;
    const args = [
      'scan',
      'source',
      '--recursive',
      '--no-ignore',
      '--allow-no-lockfiles',
      '--no-call-analysis=all',
      '--format',
      'json',
      '--verbosity',
      'error',
      '--config',
      configFile,
      rootDir,
    ];
    const { stdout } = await runCommand(this.scanners.osvPath, args, {
      cwd: rootDir,
      timeoutMs: 5 * 60_000,
      okExitCodes: [0, 1],
      env: { HOME: dirname(rootDir) },
    });
    const output = JSON.parse(stdout) as OsvOutput;
    return parseOsvOutput(output, rootDir, (path) =>
      readFile(path, 'utf8').catch(() => null),
    );
  }
}
