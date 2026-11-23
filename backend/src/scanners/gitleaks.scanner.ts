import { dirname, join } from 'node:path';
import { Inject, Injectable } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { scannersConfig } from '../config/namespaces.js';
import type { DetectedFinding } from '../risk/risk.types.js';
import { parseGitleaksOutput, type GitleaksLeak } from './gitleaks-output.js';
import { runCommand } from './run-command.js';
import type { ScanContext, Scanner } from './scanner.interface.js';

@Injectable()
export class GitleaksScanner implements Scanner {
  readonly name = 'gitleaks';
  readonly kind = 'secret' as const;

  constructor(
    @Inject(scannersConfig.KEY)
    private readonly scanners: ConfigType<typeof scannersConfig>,
  ) {}

  async scan({ rootDir }: ScanContext): Promise<DetectedFinding[]> {
    const configFile = this.scanners.gitleaksConfig;
    const args = [
      'dir',
      rootDir,
      '--report-format',
      'json',
      '--report-path',
      '-',
      '--no-banner',
      '--exit-code',
      '0',
      '--log-level',
      'error',
      '--max-target-megabytes',
      '5',
      '--ignore-gitleaks-allow',
      '--gitleaks-ignore-path',
      join(dirname(rootDir), '.no-gitleaksignore'),
      '--config',
      configFile,
    ];
    const { stdout } = await runCommand(this.scanners.gitleaksPath, args, {
      cwd: dirname(rootDir),
      timeoutMs: 5 * 60_000,
    });
    const leaks = (stdout.trim() ? JSON.parse(stdout) : []) as GitleaksLeak[];
    return parseGitleaksOutput(leaks, rootDir, this.scanners.fingerprintKey);
  }
}
