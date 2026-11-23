import type { IssueStatus } from './issue.entity.js';
import type { FindingKind } from './risk.types.js';

export interface TrackedIssue {
  id: string;
  fingerprint: string;
  kind: FindingKind;
  status: IssueStatus;
}

export interface IssueDiff {
  reopened: TrackedIssue[];
  fixed: TrackedIssue[];
  notVerified: TrackedIssue[];
}

export function diffIssues(
  issues: TrackedIssue[],
  detectedFingerprints: ReadonlySet<string>,
  verifiedKinds: readonly FindingKind[],
): IssueDiff {
  const detected = (issue: TrackedIssue) =>
    detectedFingerprints.has(issue.fingerprint);
  const missing = issues.filter((i) => i.status === 'open' && !detected(i));
  return {
    reopened: issues.filter((i) => i.status === 'fixed' && detected(i)),
    fixed: missing.filter((i) => verifiedKinds.includes(i.kind)),
    notVerified: missing.filter((i) => !verifiedKinds.includes(i.kind)),
  };
}
