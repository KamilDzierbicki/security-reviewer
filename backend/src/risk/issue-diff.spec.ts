import { diffIssues, type TrackedIssue } from './issue-diff.js';

const issue = (
  id: string,
  kind: TrackedIssue['kind'],
  status: TrackedIssue['status'] = 'open',
): TrackedIssue => ({ id, fingerprint: `fp-${id}`, kind, status });

describe('diffIssues', () => {
  it('marks a missing issue fixed only when a scanner of its kind completed', () => {
    const lodash = issue('lodash', 'dependency');
    const awsKey = issue('aws', 'secret');

    const diff = diffIssues([lodash, awsKey], new Set(), ['dependency']);

    expect(diff.fixed).toEqual([lodash]);
    expect(diff.notVerified).toEqual([awsKey]);
  });

  it('reopens a fixed issue that is detected again', () => {
    const regressed = issue('lodash', 'dependency', 'fixed');
    const stillFixed = issue('minimist', 'dependency', 'fixed');

    const diff = diffIssues(
      [regressed, stillFixed],
      new Set([regressed.fingerprint]),
      ['dependency', 'secret'],
    );

    expect(diff.reopened).toEqual([regressed]);
    expect(diff.fixed).toEqual([]);
  });

  it('leaves an open issue that is still detected unchanged', () => {
    const open = issue('aws', 'secret');

    const diff = diffIssues([open], new Set([open.fingerprint]), ['secret']);

    expect(diff).toEqual({ reopened: [], fixed: [], notVerified: [] });
  });
});
