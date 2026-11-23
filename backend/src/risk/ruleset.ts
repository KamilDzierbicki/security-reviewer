import {
  assertNever,
  type Assessment,
  type DependencyEvidence,
  type Factor,
  type FindingKind,
  type SecretEvidence,
  type Severity,
} from './risk.types.js';

export const RULESET_VERSION = 'risk-2026.11.2';

export interface ScoredInput {
  kind: FindingKind;
  ruleId: string;
  filePath: string;
  reportedSeverity: Severity;
  evidence: DependencyEvidence | SecretEvidence;
}

const SEVERITY_POINTS: Record<Severity, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
  info: 0,
};

const THRESHOLDS: [number, Severity][] = [
  [70, 'critical'],
  [50, 'high'],
  [30, 'medium'],
  [10, 'low'],
];

const HIGH_IMPACT_SECRET =
  /^(aws|gcp|azure|github|gitlab|private-key|stripe|slack|twilio|sendgrid|npm|pypi|openai|anthropic|heroku|digitalocean|shopify|hashicorp|databricks|doppler|square)/;

const NON_PRODUCTION_PATH =
  /(^|\/)(tests?|__tests__|spec|specs|fixtures?|examples?|samples?|mocks?|docs?)(\/|$)|\.(test|spec)\.[a-z]+$/i;

export function assess(input: ScoredInput): Assessment {
  const factors = factorsFor(input);
  const riskScore = Math.max(
    0,
    factors.reduce((sum, f) => sum + f.points, 0),
  );
  return { finalSeverity: severityFor(riskScore), riskScore, factors };
}

function factorsFor(input: ScoredInput): Factor[] {
  switch (input.kind) {
    case 'dependency':
      return dependencyFactors(input, input.evidence as DependencyEvidence);
    case 'secret':
      return secretFactors(input, input.evidence as SecretEvidence);
    default:
      return assertNever(input.kind);
  }
}

export function severityFor(score: number): Severity {
  return THRESHOLDS.find(([min]) => score >= min)?.[1] ?? 'info';
}

function dependencyFactors(
  input: ScoredInput,
  evidence: DependencyEvidence,
): Factor[] {
  const cvss =
    evidence.cvssScore === null ? '' : `CVSS ${evidence.cvssScore}, `;
  const damage: Factor = {
    name: 'damage',
    level: levelForSeverity(input.reportedSeverity),
    points: SEVERITY_POINTS[input.reportedSeverity],
    reason: `${cvss}rated ${input.reportedSeverity} by the advisory`,
  };

  let reachable: Factor;
  if (evidence.dev === true) {
    reachable = {
      name: 'reachable',
      level: 'low',
      points: -15,
      reason: 'Development dependency, not shipped to production',
    };
  } else if (evidence.direct === true) {
    reachable = {
      name: 'reachable',
      level: 'high',
      points: 15,
      reason: 'Direct production dependency, declared by your project',
    };
  } else if (evidence.direct === false) {
    reachable = {
      name: 'reachable',
      level: 'medium',
      points: 5,
      reason: 'Transitive production dependency',
    };
  } else {
    reachable = {
      name: 'reachable',
      level: 'unknown',
      points: 0,
      reason: 'Dependency scope unknown for this ecosystem',
    };
  }

  let exploitable: Factor;
  if (evidence.kev === true) {
    exploitable = {
      name: 'exploitable',
      level: 'high',
      points: 30,
      reason: 'Listed in CISA KEV: exploited in the wild',
    };
  } else if (evidence.epss) {
    const pct = Math.round(evidence.epss.percentile * 100);
    const score = (evidence.epss.score * 100).toFixed(1);
    if (evidence.epss.percentile >= 0.95) {
      exploitable = {
        name: 'exploitable',
        level: 'high',
        points: 20,
        reason: `EPSS ${score}% (top ${100 - pct}% most likely to be exploited)`,
      };
    } else if (evidence.epss.percentile >= 0.7) {
      exploitable = {
        name: 'exploitable',
        level: 'medium',
        points: 10,
        reason: `EPSS ${score}% (higher than ${pct}% of known CVEs)`,
      };
    } else {
      exploitable = {
        name: 'exploitable',
        level: 'low',
        points: 0,
        reason: `EPSS ${score}%: exploitation unlikely in the next 30 days`,
      };
    }
  } else {
    exploitable = {
      name: 'exploitable',
      level: 'unknown',
      points: 0,
      reason:
        evidence.intelAvailable === false
          ? 'Threat intel unavailable during this scan'
          : 'No exploitation data for this advisory',
    };
  }

  return [damage, reachable, exploitable];
}

function secretFactors(input: ScoredInput, evidence: SecretEvidence): Factor[] {
  const highImpact = HIGH_IMPACT_SECRET.test(input.ruleId);
  const damage: Factor = highImpact
    ? {
        name: 'damage',
        level: 'high',
        points: 40,
        reason: `${evidence.secretType}: grants direct access to the account or system it belongs to`,
      }
    : {
        name: 'damage',
        level: 'medium',
        points: 20,
        reason: `${evidence.secretType}: impact depends on what the key unlocks`,
      };

  const reachable: Factor = NON_PRODUCTION_PATH.test(input.filePath)
    ? {
        name: 'reachable',
        level: 'low',
        points: -15,
        reason: 'In test or example code, often a placeholder',
      }
    : {
        name: 'reachable',
        level: 'high',
        points: 20,
        reason: 'Committed to a public repository: anyone can read it',
      };

  const exploitable: Factor = highImpact
    ? {
        name: 'exploitable',
        level: 'medium',
        points: 10,
        reason:
          'Matches a provider-specific key format (not yet verified live)',
      }
    : {
        name: 'exploitable',
        level: 'low',
        points: 0,
        reason: 'Generic pattern, may be a false positive',
      };

  return [damage, reachable, exploitable];
}

function levelForSeverity(severity: Severity): Factor['level'] {
  if (severity === 'critical' || severity === 'high') return 'high';
  if (severity === 'medium') return 'medium';
  return 'low';
}
