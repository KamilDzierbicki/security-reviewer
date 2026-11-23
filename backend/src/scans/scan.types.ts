export const SCAN_RUN_STATUSES = [
  'queued',
  'running',
  'completed',
  'partial',
  'failed',
] as const;
export type ScanRunStatus = (typeof SCAN_RUN_STATUSES)[number];
export const ACTIVE_RUN_STATUSES: readonly ScanRunStatus[] = [
  'queued',
  'running',
];
export const TERMINAL_RUN_STATUSES: readonly ScanRunStatus[] = [
  'completed',
  'partial',
  'failed',
];

export const STAGE_NAMES = [
  'clone',
  'scan',
  'enrich',
  'prioritize',
  'summarize',
] as const;
export type StageName = (typeof STAGE_NAMES)[number];

export type StageStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export type ScannerRunStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface RunChanges {
  newIssueIds: string[];
  reopenedIssueIds: string[];
  fixedIssueIds: string[];
  notVerifiedIssueIds: string[];
}
