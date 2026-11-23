import { createHash, createHmac } from 'node:crypto';
import { assertNever, type DetectedFinding } from './risk.types.js';

export function fingerprintOf(finding: DetectedFinding): string {
  return createHash('sha256')
    .update(fingerprintParts(finding).join('\u0000'))
    .digest('hex');
}

function fingerprintParts(finding: DetectedFinding): string[] {
  switch (finding.kind) {
    case 'dependency':
      return [
        finding.kind,
        finding.evidence.ecosystem,
        finding.evidence.package,
        finding.evidence.vulnId,
        finding.evidence.manifestPath,
      ];
    case 'secret':
      return [
        finding.kind,
        finding.ruleId,
        finding.filePath,
        finding.evidence.valueHash,
      ];
    default:
      return assertNever(finding);
  }
}

export function hashSecretValue(value: string, key: string): string {
  return createHmac('sha256', key).update(value).digest('hex');
}
