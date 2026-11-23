import type { Repository } from '../repositories/repository.entity.js';
import {
  assertNever,
  type DependencyEvidence,
  type FindingKind,
  type SecretEvidence,
} from '../risk/risk.types.js';
import type { ScoredFinding } from '../risk/risk-groups.js';
import type { Issue } from '../risk/issue.entity.js';
import type { ScanRun } from './scan-run.entity.js';
import type { ScanStage } from './scan-stage.entity.js';
import type { ScannerRun } from './scanner-run.entity.js';
import { TERMINAL_RUN_STATUSES, type StageName } from './scan.types.js';

const STAGE_WEIGHT: Record<StageName, number> = {
  clone: 25,
  scan: 45,
  enrich: 10,
  prioritize: 5,
  summarize: 15,
};

const STAGE_LABEL: Record<StageName, string> = {
  clone: 'Fetching the commit',
  scan: 'Scanning dependencies and secrets',
  enrich: 'Checking exploit intelligence (EPSS, CISA KEV)',
  prioritize: 'Ranking by context',
  summarize: 'Writing the summary',
};

export function progressPercent(
  run: ScanRun,
  stages: ScanStage[],
  scanners: ScannerRun[],
): number {
  if (TERMINAL_RUN_STATUSES.includes(run.status)) return 100;
  let done = 0;
  for (const stage of stages) {
    const weight = STAGE_WEIGHT[stage.name];
    if (stage.status === 'completed' || stage.status === 'skipped') {
      done += weight;
    } else if (stage.name === 'scan' && scanners.length > 0) {
      const finished = scanners.filter(
        (s) => s.status === 'completed' || s.status === 'failed',
      ).length;
      done += (weight * finished) / scanners.length;
    }
  }
  return Math.min(99, Math.round(done));
}

export function statusView(
  run: ScanRun,
  repository: Repository,
  stages: ScanStage[],
  scanners: ScannerRun[],
) {
  return {
    id: run.id,
    status: run.status,
    repository: { id: repository.id, fullName: repository.fullName },
    commitSha: run.commitSha,
    error: run.error,
    progress: progressPercent(run, stages, scanners),
    createdAt: run.createdAt,
    startedAt: run.startedAt,
    finishedAt: run.finishedAt,
    stages: [...stages]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        name: s.name,
        label: STAGE_LABEL[s.name],
        status: s.status,
        note: s.error,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
      })),
    scanners: [...scanners]
      .sort((a, b) => a.scanner.localeCompare(b.scanner))
      .map((s) => ({
        name: s.scanner,
        kind: s.kind,
        status: s.status,
        findingCount: s.findingCount,
        error: s.error,
        durationMs:
          s.startedAt && s.finishedAt
            ? s.finishedAt.getTime() - s.startedAt.getTime()
            : null,
      })),
  };
}

export type StatusView = ReturnType<typeof statusView>;

export function publicEvidence(
  kind: FindingKind,
  evidence: DependencyEvidence | SecretEvidence,
) {
  switch (kind) {
    case 'dependency':
      return evidence as DependencyEvidence;
    case 'secret': {
      const { secretType, masked, line } = evidence as SecretEvidence;
      return { secretType, masked, line };
    }
    default:
      return assertNever(kind);
  }
}

export function runListItemView(run: ScanRun) {
  return {
    id: run.id,
    status: run.status,
    commitSha: run.commitSha,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
  };
}

export function findingView(finding: ScoredFinding) {
  return {
    id: finding.id,
    ruleId: finding.ruleId,
    title: finding.title,
    filePath: finding.filePath,
    reportedSeverity: finding.reportedSeverity,
    finalSeverity: finding.finalSeverity,
    riskScore: finding.riskScore,
    factors: finding.factors,
    evidence: publicEvidence(finding.kind, finding.evidence),
  };
}

export function issueRefView(issue: Issue) {
  return { id: issue.id, kind: issue.kind, title: issue.title };
}
