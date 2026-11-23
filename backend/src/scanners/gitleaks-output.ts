import { isAbsolute, relative } from 'node:path';
import { hashSecretValue } from '../risk/fingerprint.js';
import { maskSecret } from '../risk/masking.js';
import type { DetectedSecretFinding } from '../risk/risk.types.js';

export interface GitleaksLeak {
  RuleID: string;
  Description?: string;
  File: string;
  StartLine: number;
  Secret: string;
}

const ACRONYMS = new Set([
  'aws',
  'gcp',
  'api',
  'jwt',
  'npm',
  'ssh',
  'rsa',
  'pgp',
  'id',
  'url',
  'pat',
  'sas',
  'oauth',
  'dsa',
  'ec',
  'sdk',
]);

export function parseGitleaksOutput(
  leaks: GitleaksLeak[],
  rootDir: string,
  hashKey: string,
  scanner = 'gitleaks',
): DetectedSecretFinding[] {
  return leaks.map((leak) => {
    const filePath = isAbsolute(leak.File)
      ? relative(rootDir, leak.File)
      : leak.File;
    const secretType = humanizeRule(leak.RuleID);
    return {
      kind: 'secret',
      scanner,
      ruleId: leak.RuleID,
      title: `${secretType} exposed in ${filePath}`,
      filePath,
      reportedSeverity: 'high',
      evidence: {
        secretType,
        masked: maskSecret(leak.Secret),
        valueHash: hashSecretValue(leak.Secret, hashKey),
        line: leak.StartLine,
      },
    };
  });
}

export function humanizeRule(ruleId: string): string {
  const words = ruleId
    .split('-')
    .map((w) => (ACRONYMS.has(w) ? w.toUpperCase() : w));
  const text = words.join(' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
}
