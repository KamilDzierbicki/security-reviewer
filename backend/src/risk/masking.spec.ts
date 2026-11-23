import { parseGitleaksOutput } from '../scanners/gitleaks-output.js';
import { fingerprintOf } from './fingerprint.js';
import { maskSecret } from './masking.js';

const KEY = 'k'.repeat(32);
const SECRET = 'AKIAZ7Q3XG4KP2LMRT5W';

const leak = (
  overrides: Partial<{ Secret: string; StartLine: number }> = {},
) => ({
  RuleID: 'aws-access-token',
  File: '/scan/src/config.js',
  StartLine: 4,
  Secret: SECRET,
  ...overrides,
});

describe('secret masking', () => {
  it('keeps a short prefix and hides the rest and the length', () => {
    expect(maskSecret(SECRET)).toBe('AKIA********');
    expect(maskSecret('short')).toBe('********');
    expect(maskSecret('x'.repeat(200))).toHaveLength(12);
  });

  it('never lets the raw secret reach what we persist', () => {
    const [finding] = parseGitleaksOutput([leak()], '/scan', KEY);
    expect(JSON.stringify(finding)).not.toContain(SECRET);
    expect(JSON.stringify(finding)).not.toContain(SECRET.slice(4));
    expect(finding.evidence.masked).toBe('AKIA********');
    expect(finding.filePath).toBe('src/config.js');
  });

  it('keys the fingerprint on the value, not on the line number', () => {
    const [a] = parseGitleaksOutput([leak()], '/scan', KEY);
    const [moved] = parseGitleaksOutput(
      [leak({ StartLine: 40 })],
      '/scan',
      KEY,
    );
    const [rotated] = parseGitleaksOutput(
      [leak({ Secret: 'AKIAQ4M7ZK2W9XPLR3TB' })],
      '/scan',
      KEY,
    );
    expect(fingerprintOf(moved)).toBe(fingerprintOf(a));
    expect(fingerprintOf(rotated)).not.toBe(fingerprintOf(a));
  });

  it('uses a keyed hash, so the stored hash cannot be checked without the key', () => {
    const [a] = parseGitleaksOutput([leak()], '/scan', KEY);
    const [b] = parseGitleaksOutput([leak()], '/scan', 'other'.repeat(8));
    expect(a.evidence.valueHash).not.toBe(b.evidence.valueHash);
  });
});
