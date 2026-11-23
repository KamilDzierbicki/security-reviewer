import { createHash } from 'node:crypto';
import {
  assertNever,
  SEVERITIES,
  type DependencyEvidence,
  type Factor,
  type FindingKind,
  type SecretEvidence,
  type Severity,
} from './risk.types.js';
import { maxVersion } from './version.js';

export interface ScoredFinding {
  id: string;
  fingerprint: string;
  kind: FindingKind;
  ruleId: string;
  title: string;
  filePath: string;
  reportedSeverity: Severity;
  finalSeverity: Severity;
  riskScore: number;
  factors: Factor[];
  evidence: DependencyEvidence | SecretEvidence;
}

export interface RiskGroup {
  id: string;
  kind: FindingKind;
  title: string;
  location: string;
  finalSeverity: Severity;
  reportedSeverity: Severity;
  riskScore: number;
  factors: Factor[];
  findingIds: string[];
  advisoryCount: number;
  action: string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export function compareFindings(a: ScoredFinding, b: ScoredFinding): number {
  return (
    b.riskScore - a.riskScore ||
    points(b, 'damage') - points(a, 'damage') ||
    Number(kev(b)) - Number(kev(a)) ||
    epss(b) - epss(a) ||
    a.title.localeCompare(b.title) ||
    a.fingerprint.localeCompare(b.fingerprint)
  );
}

export function buildRiskGroups(findings: ScoredFinding[]): RiskGroup[] {
  const sorted = [...findings].sort(compareFindings);
  const groups = new Map<string, ScoredFinding[]>();
  for (const finding of sorted) {
    const key = groupKey(finding);
    const members = groups.get(key);
    if (members) members.push(finding);
    else groups.set(key, [finding]);
  }
  return [...groups.entries()].map(([key, members]) => toGroup(key, members));
}

function groupKey(finding: ScoredFinding): string {
  switch (finding.kind) {
    case 'dependency': {
      const e = finding.evidence as DependencyEvidence;
      return [
        'dependency',
        e.ecosystem,
        e.package,
        e.version,
        e.manifestPath,
      ].join('|');
    }
    case 'secret':
      return `secret|${finding.fingerprint}`;
    default:
      return assertNever(finding.kind);
  }
}

function toGroup(key: string, members: ScoredFinding[]): RiskGroup {
  const top = members[0];
  const id = createHash('sha256').update(key).digest('hex').slice(0, 12);
  const reportedSeverity = members.reduce<Severity>(
    (max, f) =>
      SEVERITY_RANK[f.reportedSeverity] > SEVERITY_RANK[max]
        ? f.reportedSeverity
        : max,
    'info',
  );
  const base = {
    id,
    kind: top.kind,
    finalSeverity: top.finalSeverity,
    reportedSeverity,
    riskScore: top.riskScore,
    factors: top.factors,
    findingIds: members.map((f) => f.id),
    advisoryCount: members.length,
  };
  switch (top.kind) {
    case 'dependency': {
      const e = top.evidence as DependencyEvidence;
      return {
        ...base,
        title: `${e.package} ${e.version} (${e.ecosystem})`,
        location: e.manifestPath,
        action: dependencyAction(e, members),
      };
    }
    case 'secret': {
      const e = top.evidence as SecretEvidence;
      return {
        ...base,
        title: `${e.secretType} in ${top.filePath}`,
        location: `${top.filePath}:${e.line}`,
        action: secretAction(top, e),
      };
    }
    default:
      return assertNever(top.kind);
  }
}

function dependencyAction(
  e: DependencyEvidence,
  members: ScoredFinding[],
): string {
  const fixes = members
    .map((f) => (f.evidence as DependencyEvidence).fixedVersion)
    .filter((v): v is string => v !== null);
  const unfixed = members.length - fixes.length;
  const target = maxVersion(fixes);
  const fixesText =
    members.length === 1
      ? 'the advisory'
      : `all ${members.length - unfixed} fixable advisories`;
  if (!target) {
    return `No fixed version of ${e.package} is published yet. Replace it or limit how your code uses it, and watch the advisory.`;
  }
  const how =
    e.direct === false
      ? `Update the dependency that pulls in ${e.package} ${e.version} so it resolves ${target} or later (or pin it with an override in ${declaredIn(e)})`
      : `Upgrade ${e.package} from ${e.version} to ${target} or later (${declaredIn(e)})`;
  const rest =
    unfixed > 0
      ? ` ${unfixed === 1 ? '1 advisory has' : `${unfixed} advisories have`} no fix yet.`
      : '';
  return `${how}; this resolves ${fixesText}.${rest}`;
}

function declaredIn(e: DependencyEvidence): string {
  return e.ecosystem === 'npm'
    ? e.manifestPath.replace(
        /(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml)$/,
        'package.json',
      )
    : e.manifestPath;
}

function secretAction(finding: ScoredFinding, e: SecretEvidence): string {
  const reachable = finding.factors.find((f) => f.name === 'reachable');
  if (reachable?.level === 'low') {
    return `Check whether the value in ${finding.filePath} is a real credential. If it is, rotate it and load it from a secret manager.`;
  }
  const damage = finding.factors.find((f) => f.name === 'damage');
  if (damage?.level === 'high') {
    return `Revoke and rotate this ${e.secretType} now, then remove it from ${finding.filePath} and from the git history.`;
  }
  return `Rotate this credential and load it from the environment or a secret manager instead of ${finding.filePath}.`;
}

function points(f: ScoredFinding, name: Factor['name']): number {
  return f.factors.find((x) => x.name === name)?.points ?? 0;
}

function kev(f: ScoredFinding): boolean {
  return (
    f.kind === 'dependency' && (f.evidence as DependencyEvidence).kev === true
  );
}

function epss(f: ScoredFinding): number {
  return f.kind === 'dependency'
    ? ((f.evidence as DependencyEvidence).epss?.score ?? 0)
    : 0;
}

export function countBySeverity(
  items: { finalSeverity: Severity }[],
): Record<Severity, number> {
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    Severity,
    number
  >;
  for (const item of items) counts[item.finalSeverity] += 1;
  return counts;
}
