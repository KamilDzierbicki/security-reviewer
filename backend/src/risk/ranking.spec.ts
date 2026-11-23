import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitleaksLeak } from '../scanners/gitleaks-output.js';
import { parseGitleaksOutput } from '../scanners/gitleaks-output.js';
import { parseOsvOutput, type OsvOutput } from '../scanners/osv-output.js';
import { fingerprintOf } from './fingerprint.js';
import { buildRiskGroups, type ScoredFinding } from './risk-groups.js';
import type {
  DependencyEvidence,
  DetectedFinding,
  EpssScore,
} from './risk.types.js';
import { assess } from './ruleset.js';
import {
  withThreatIntel,
  type ThreatIntel,
} from '../threat-intel/threat-intel.service.js';

const FIXTURES = join(import.meta.dirname, '../../test/fixtures');
const SCAN_ROOT = '/scan';

interface IntelSnapshot {
  kev: string[];
  epss: Record<string, EpssScore>;
}

async function loadFindings(): Promise<DetectedFinding[]> {
  const osv = JSON.parse(
    await readFile(join(FIXTURES, 'scanner-output/osv.json'), 'utf8'),
  ) as OsvOutput;
  const leaks = JSON.parse(
    await readFile(join(FIXTURES, 'scanner-output/gitleaks.json'), 'utf8'),
  ) as GitleaksLeak[];
  const dependencies = await parseOsvOutput(osv, SCAN_ROOT, (path) =>
    readFile(
      path.replace(SCAN_ROOT, join(FIXTURES, 'planted-repo')),
      'utf8',
    ).catch(() => null),
  );
  const secrets = parseGitleaksOutput(leaks, SCAN_ROOT, 'test-key'.repeat(8));
  return [...dependencies, ...secrets];
}

async function rank(extraKev: string[] = []) {
  const intel = JSON.parse(
    await readFile(join(FIXTURES, 'scanner-output/threat-intel.json'), 'utf8'),
  ) as IntelSnapshot;
  const threatIntel: ThreatIntel = {
    available: true,
    kev: new Set([...intel.kev, ...extraKev]),
    epss: new Map(Object.entries(intel.epss)),
  };
  const scored: ScoredFinding[] = (await loadFindings()).map((finding, i) => {
    if (finding.kind === 'dependency') {
      finding.evidence = withThreatIntel(finding.evidence, threatIntel);
    }
    return {
      ...finding,
      ...assess(finding),
      id: `f${i}`,
      fingerprint: fingerprintOf(finding),
    };
  });
  return buildRiskGroups(scored);
}

const pkg = (name: string) => (g: { title: string }) =>
  g.title.startsWith(`${name} `);

describe('ranking of the planted fixture repository', () => {
  it('puts the AWS key committed to application code first', async () => {
    const groups = await rank();
    expect(groups[0].kind).toBe('secret');
    expect(groups[0].title).toBe('AWS access token in src/config.js');
    expect(groups[0].finalSeverity).toBe('critical');
  });

  it('ranks a token in test code below every production finding of its kind', async () => {
    const groups = await rank();
    const secrets = groups.filter((g) => g.kind === 'secret');
    const inTests = secrets.find((g) => g.location.startsWith('test/'));
    expect(inTests).toBeDefined();
    expect(secrets.at(-1)).toBe(inTests);
    expect(inTests!.finalSeverity).toBe('info');
  });

  it('downgrades critical advisories in a dev-only dependency below production ones', async () => {
    const groups = await rank();
    const handlebars = groups.find(pkg('handlebars'))!;
    const lodash = groups.find(pkg('lodash'))!;
    expect(handlebars.reportedSeverity).toBe('critical');
    expect(handlebars.finalSeverity).toBe('medium');
    expect(groups.indexOf(lodash)).toBeLessThan(groups.indexOf(handlebars));
  });

  it('ranks a direct dependency above a transitive one with a similar advisory', async () => {
    const groups = await rank();
    const axios = groups.find(pkg('axios'))!;
    const qs = groups.find(pkg('qs'))!;
    expect(axios.factors.find((f) => f.name === 'reachable')?.level).toBe(
      'high',
    );
    expect(qs.factors.find((f) => f.name === 'reachable')?.level).toBe(
      'medium',
    );
    expect(groups.indexOf(axios)).toBeLessThan(groups.indexOf(qs));
  });

  it('moves an advisory exploited in the wild (CISA KEV) above higher CVSS scores', async () => {
    const before = await rank();
    const send = before.find(pkg('send'))!;
    const after = await rank(['CVE-2024-43799']);
    const sendAfter = after.find(pkg('send'))!;
    expect(after.indexOf(sendAfter)).toBeLessThan(before.indexOf(send));
    expect(sendAfter.factors.find((f) => f.name === 'exploitable')?.level).toBe(
      'high',
    );
  });

  it('groups all advisories of one package version into one action', async () => {
    const groups = await rank();
    const lodash = groups.find(pkg('lodash'))!;
    expect(lodash.advisoryCount).toBe(5);
    expect(lodash.action).toBe(
      'Upgrade lodash from 4.17.15 to 4.18.0 or later (package.json); this resolves all 5 fixable advisories.',
    );
  });

  it('is deterministic regardless of input order', async () => {
    const findings = await loadFindings();
    const score = (list: DetectedFinding[]) =>
      buildRiskGroups(
        list.map((f) => ({
          ...f,
          ...assess(f),
          id: fingerprintOf(f),
          fingerprint: fingerprintOf(f),
        })),
      ).map((g) => g.id);
    const reversed = [...findings].reverse();
    expect(score(reversed)).toEqual(score(findings));
  });

  it('reads direct and dev scope from the manifest next to the lockfile', async () => {
    const findings = await loadFindings();
    const evidence = (name: string) =>
      findings.find(
        (f) =>
          f.kind === 'dependency' &&
          (f.evidence as DependencyEvidence).package === name,
      )!.evidence as DependencyEvidence;
    expect(evidence('lodash')).toMatchObject({ direct: true, dev: false });
    expect(evidence('qs')).toMatchObject({ direct: false, dev: false });
    expect(evidence('handlebars')).toMatchObject({ direct: true, dev: true });
  });
});
