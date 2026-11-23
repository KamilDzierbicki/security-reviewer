export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type RunStatus =
  'queued' | 'running' | 'completed' | 'partial' | 'failed';
export type StepStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export const TERMINAL_STATUSES: readonly RunStatus[] = [
  'completed',
  'partial',
  'failed',
];

export interface LatestRun {
  id: string;
  status: RunStatus;
  createdAt: string;
  finishedAt: string | null;
}

export interface RepositoryView {
  id: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  createdAt: string;
  latestRun: LatestRun | null;
}

export interface StatusView {
  id: string;
  status: RunStatus;
  repository: { id: string; fullName: string };
  commitSha: string | null;
  error: string | null;
  progress: number;
  stages: {
    name: string;
    label: string;
    status: StepStatus;
    note: string | null;
  }[];
  scanners: {
    name: string;
    kind: string;
    status: StepStatus;
    findingCount: number | null;
  }[];
}

export interface Factor {
  name: string;
  level: string;
  points: number;
  reason: string;
}

export interface RiskGroup {
  id: string;
  kind: 'dependency' | 'secret';
  title: string;
  location: string;
  finalSeverity: Severity;
  reportedSeverity: Severity;
  riskScore: number;
  factors: Factor[];
  advisoryCount: number;
  action: string;
}

export interface TopRisk extends RiskGroup {
  why: string | null;
  nextAction: string;
}

export interface FindingView {
  id: string;
  ruleId: string;
  title: string;
  filePath: string;
  reportedSeverity: Severity;
  finalSeverity: Severity;
  riskScore: number;
  evidence: { masked?: string };
}

export interface IssueRef {
  id: string;
  kind: string;
  title: string;
}

export interface ChangesView {
  isFirstScan: boolean;
  new: IssueRef[];
  reopened: IssueRef[];
  fixed: IssueRef[];
  secretsRemovedFromCode: IssueRef[];
  notVerified: IssueRef[];
}

export interface ResultView {
  run: StatusView;
  rulesetVersion?: string;
  summary: {
    source: 'llm' | 'template';
    model: string | null;
    headline: string;
    overview: string;
  } | null;
  severityCounts: Record<Severity, number> | null;
  totals?: { findings: number; risks: number };
  topRisks: TopRisk[];
  changes: ChangesView | null;
  risks: (RiskGroup & { findings: FindingView[] })[];
}
