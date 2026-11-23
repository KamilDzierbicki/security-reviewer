import { basename, dirname, join, relative } from 'node:path';
import type {
  DetectedDependencyFinding,
  Severity,
} from '../risk/risk.types.js';
import { compareVersions } from '../risk/version.js';

export interface OsvOutput {
  results?: {
    source: { path: string; type: string };
    packages?: {
      package: { name: string; version: string; ecosystem: string };
      dependency_groups?: string[];
      vulnerabilities?: OsvVulnerability[];
      groups?: { ids: string[]; aliases?: string[]; max_severity?: string }[];
    }[];
  }[];
}

interface OsvVulnerability {
  id: string;
  summary?: string;
  aliases?: string[];
  database_specific?: { severity?: string };
  affected?: {
    package?: { name?: string; ecosystem?: string };
    ranges?: { events?: Record<string, string>[] }[];
  }[];
}

const NPM_LOCKFILES = new Set([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

const ADVISORY_SEVERITY: Record<string, Severity> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MODERATE: 'medium',
  MEDIUM: 'medium',
  LOW: 'low',
};

export type ReadText = (path: string) => Promise<string | null>;

export async function parseOsvOutput(
  output: OsvOutput,
  rootDir: string,
  readText: ReadText,
  scanner = 'osv-scanner',
): Promise<DetectedDependencyFinding[]> {
  const findings: DetectedDependencyFinding[] = [];
  for (const result of output.results ?? []) {
    const manifestPath = relative(rootDir, result.source.path);
    if (manifestPath.startsWith('..')) continue;
    const directNames = await readDirectNpmDependencies(
      result.source.path,
      readText,
    );

    for (const pkg of result.packages ?? []) {
      const { name, version, ecosystem } = pkg.package;
      const isNpm = ecosystem === 'npm';
      const dev = pkg.dependency_groups
        ? pkg.dependency_groups.includes('dev')
        : isNpm
          ? false
          : null;
      const direct = isNpm && directNames ? directNames.has(name) : null;

      for (const group of pkg.groups ?? []) {
        const vulns = (pkg.vulnerabilities ?? []).filter((v) =>
          group.ids.includes(v.id),
        );
        if (vulns.length === 0) continue;
        const vulnId = canonicalId(group.ids);
        const cvss = Number.parseFloat(group.max_severity ?? '');
        const cvssScore = Number.isFinite(cvss) ? cvss : null;
        findings.push({
          kind: 'dependency',
          scanner,
          ruleId: vulnId,
          title: vulns.find((v) => v.summary)?.summary ?? vulnId,
          filePath: manifestPath,
          reportedSeverity: reportedSeverity(vulns, cvssScore),
          evidence: {
            ecosystem,
            package: name,
            version,
            vulnId,
            aliases: [...new Set(group.aliases ?? [])].sort(),
            cvssScore,
            fixedVersion: fixedVersionFor(vulns, name, ecosystem, version),
            manifestPath,
            direct,
            dev,
          },
        });
      }
    }
  }
  return findings;
}

export function canonicalId(ids: string[]): string {
  const sorted = [...ids].sort();
  return (
    sorted.find((id) => id.startsWith('GHSA-')) ??
    sorted.find((id) => id.startsWith('CVE-')) ??
    sorted[0]
  );
}

async function readDirectNpmDependencies(
  lockfilePath: string,
  readText: ReadText,
): Promise<Set<string> | null> {
  if (!NPM_LOCKFILES.has(basename(lockfilePath))) return null;
  const text = await readText(join(dirname(lockfilePath), 'package.json'));
  if (!text) return null;
  try {
    const manifest = JSON.parse(text) as Record<string, unknown>;
    const names = new Set<string>();
    for (const field of [
      'dependencies',
      'devDependencies',
      'optionalDependencies',
      'peerDependencies',
    ]) {
      const deps = manifest[field];
      if (deps && typeof deps === 'object') {
        Object.keys(deps).forEach((n) => names.add(n));
      }
    }
    return names;
  } catch {
    return null;
  }
}

function reportedSeverity(
  vulns: OsvVulnerability[],
  cvssScore: number | null,
): Severity {
  const fromAdvisory = vulns
    .map((v) => ADVISORY_SEVERITY[v.database_specific?.severity ?? ''])
    .find(Boolean);
  if (fromAdvisory) return fromAdvisory;
  if (cvssScore === null) return 'medium';
  if (cvssScore >= 9) return 'critical';
  if (cvssScore >= 7) return 'high';
  if (cvssScore >= 4) return 'medium';
  return 'low';
}

function fixedVersionFor(
  vulns: OsvVulnerability[],
  name: string,
  ecosystem: string,
  installed: string,
): string | null {
  const fixes = vulns
    .flatMap((v) => v.affected ?? [])
    .filter(
      (a) => a.package?.name === name && a.package?.ecosystem === ecosystem,
    )
    .flatMap((a) => a.ranges ?? [])
    .flatMap((r) => r.events ?? [])
    .map((e) => e.fixed)
    .filter((v): v is string => typeof v === 'string')
    .filter((v) => compareVersions(v, installed) > 0)
    .sort(compareVersions);
  return fixes[0] ?? null;
}
