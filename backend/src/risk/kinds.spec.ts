import { buildRiskGroups, type ScoredFinding } from './risk-groups.js';
import type { FindingKind } from './risk.types.js';
import { assess, type ScoredInput } from './ruleset.js';

const unknownKind = 'code' as unknown as FindingKind;

describe('finding kinds', () => {
  it('refuses to score a finding of an unknown kind', () => {
    const input: ScoredInput = {
      kind: unknownKind,
      ruleId: 'sast.sql-injection',
      filePath: 'src/db.ts',
      reportedSeverity: 'high',
      evidence: {
        secretType: 'n/a',
        masked: '',
        valueHash: 'x',
        line: 1,
      },
    };
    expect(() => assess(input)).toThrow('Unhandled finding kind: code');
  });

  it('refuses to group a finding of an unknown kind', () => {
    const finding: ScoredFinding = {
      id: 'f1',
      fingerprint: 'a'.repeat(64),
      kind: unknownKind,
      ruleId: 'sast.sql-injection',
      title: 'SQL injection',
      filePath: 'src/db.ts',
      reportedSeverity: 'high',
      finalSeverity: 'high',
      riskScore: 50,
      factors: [],
      evidence: { secretType: 'n/a', masked: '', valueHash: 'x', line: 1 },
    };
    expect(() => buildRiskGroups([finding])).toThrow(
      'Unhandled finding kind: code',
    );
  });
});
