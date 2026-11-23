export const FINDING_KINDS = ['dependency', 'secret'] as const;
export type FindingKind = (typeof FINDING_KINDS)[number];

export function assertNever(value: never): never {
  throw new Error(`Unhandled finding kind: ${String(value)}`);
}

export const SEVERITIES = [
  'critical',
  'high',
  'medium',
  'low',
  'info',
] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface EpssScore {
  score: number;
  percentile: number;
}

export interface DependencyEvidence {
  ecosystem: string;
  package: string;
  version: string;
  vulnId: string;
  aliases: string[];
  cvssScore: number | null;
  fixedVersion: string | null;
  manifestPath: string;
  direct: boolean | null;
  dev: boolean | null;
  epss?: EpssScore | null;
  kev?: boolean | null;
  intelAvailable?: boolean;
}

export interface SecretEvidence {
  secretType: string;
  masked: string;
  valueHash: string;
  line: number;
}

interface DetectedBase {
  scanner: string;
  ruleId: string;
  title: string;
  filePath: string;
  reportedSeverity: Severity;
}

export interface DetectedDependencyFinding extends DetectedBase {
  kind: Extract<FindingKind, 'dependency'>;
  evidence: DependencyEvidence;
}

export interface DetectedSecretFinding extends DetectedBase {
  kind: Extract<FindingKind, 'secret'>;
  evidence: SecretEvidence;
}

export type DetectedFinding = DetectedDependencyFinding | DetectedSecretFinding;

export type FactorName = 'damage' | 'reachable' | 'exploitable';
export type FactorLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface Factor {
  name: FactorName;
  level: FactorLevel;
  points: number;
  reason: string;
}

export interface Assessment {
  finalSeverity: Severity;
  riskScore: number;
  factors: Factor[];
}
