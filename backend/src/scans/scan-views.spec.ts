import { publicEvidence } from './scan-views.js';

describe('publicEvidence', () => {
  it('drops the keyed hash of a secret and keeps what the user needs', () => {
    const view = publicEvidence('secret', {
      secretType: 'AWS access key',
      masked: 'AKIA********',
      valueHash: 'f'.repeat(64),
      line: 3,
    });
    expect(view).toEqual({
      secretType: 'AWS access key',
      masked: 'AKIA********',
      line: 3,
    });
    expect(JSON.stringify(view)).not.toContain('valueHash');
  });
});
