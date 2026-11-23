import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { buildScanFlow, SCANNER_QUEUE } from '../pipeline/queues.js';
import { fingerprintOf } from '../risk/fingerprint.js';
import type { DetectedFinding } from '../risk/risk.types.js';
import { assess } from '../risk/ruleset.js';
import { SCANNERS, type Scanner } from './scanner.interface.js';
import { SCANNER_CLASSES, scannerProviders } from './scanners.module.js';
import { scannersConfig } from '../config/namespaces.js';

@Injectable()
class FakeSecretScanner implements Scanner {
  readonly name = 'fake-secrets';
  readonly kind = 'secret' as const;

  scan(): Promise<DetectedFinding[]> {
    return Promise.resolve([
      {
        kind: 'secret',
        scanner: this.name,
        ruleId: 'stripe-access-token',
        title: 'Stripe access token exposed in app.js',
        filePath: 'app.js',
        reportedSeverity: 'high',
        evidence: {
          secretType: 'Stripe access token',
          masked: 'sk_l********',
          valueHash: 'a'.repeat(64),
          line: 3,
        },
      },
    ]);
  }
}

describe('scanner registry', () => {
  it('picks up a scanner added to the list in one line', async () => {
    const classes = [...SCANNER_CLASSES, FakeSecretScanner];
    const moduleRef = await Test.createTestingModule({
      providers: [
        ...scannerProviders(classes),
        { provide: scannersConfig.KEY, useValue: {} },
      ],
    })
      .useMocker(() => ({}))
      .compile();
    const scanners = moduleRef.get<Scanner[]>(SCANNERS);
    expect(scanners.map((s) => s.name)).toEqual([
      'osv-scanner',
      'gitleaks',
      'fake-secrets',
    ]);

    const flow = buildScanFlow('run-1', 2, scanners);
    expect(flow.children).toContainEqual(
      expect.objectContaining({
        queueName: SCANNER_QUEUE,
        data: { runId: 'run-1', attempt: 2, scanner: 'fake-secrets' },
        opts: expect.objectContaining({ jobId: 'run-1-fake-secrets-2' }),
      }),
    );

    const [finding] = await scanners[2].scan({ rootDir: '/scan' });
    expect(fingerprintOf(finding)).toMatch(/^[0-9a-f]{64}$/);
    expect(assess(finding).finalSeverity).toBe('critical');
  });
});
