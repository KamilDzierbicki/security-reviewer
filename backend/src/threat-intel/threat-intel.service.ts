import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS } from '../redis/redis.module.js';
import type { DependencyEvidence, EpssScore } from '../risk/risk.types.js';

const KEV_URL =
  'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const EPSS_URL = 'https://api.first.org/data/v1/epss';
const KEV_KEY = 'intel:kev';
const EPSS_PREFIX = 'intel:epss:';
const TTL_SECONDS = 12 * 60 * 60;
const EPSS_BATCH = 50;
const TIMEOUT_MS = 15_000;

export interface ThreatIntel {
  available: boolean;
  kev: Set<string>;
  epss: Map<string, EpssScore>;
}

export function withThreatIntel(
  evidence: DependencyEvidence,
  intel: ThreatIntel,
): DependencyEvidence {
  const ids = [evidence.vulnId, ...evidence.aliases];
  const scores = ids
    .map((id) => intel.epss.get(id))
    .filter((score) => score !== undefined);
  return {
    ...evidence,
    intelAvailable: intel.available,
    kev: intel.available ? ids.some((id) => intel.kev.has(id)) : null,
    epss: scores.sort((a, b) => b.score - a.score)[0] ?? null,
  };
}

@Injectable()
export class ThreatIntelService {
  private readonly logger = new Logger(ThreatIntelService.name);

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async lookup(cves: string[]): Promise<ThreatIntel> {
    const unique = [...new Set(cves)].sort();
    try {
      const [kev, epss] = await Promise.all([
        this.kevCatalog(),
        this.epssScores(unique),
      ]);
      return { available: true, kev, epss };
    } catch (error) {
      this.logger.warn('Threat intel unavailable', { error: String(error) });
      return { available: false, kev: new Set(), epss: new Map() };
    }
  }

  private async kevCatalog(): Promise<Set<string>> {
    const cached = await this.redis.get(KEV_KEY);
    if (cached) return new Set(JSON.parse(cached) as string[]);
    const response = await fetch(KEV_URL, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`KEV feed returned ${response.status}`);
    const body = (await response.json()) as {
      vulnerabilities: { cveID: string }[];
    };
    const ids = body.vulnerabilities.map((v) => v.cveID);
    await this.redis.set(KEV_KEY, JSON.stringify(ids), 'EX', TTL_SECONDS);
    return new Set(ids);
  }

  private async epssScores(cves: string[]): Promise<Map<string, EpssScore>> {
    const result = new Map<string, EpssScore>();
    if (cves.length === 0) return result;
    const cached = await this.redis.mget(cves.map((c) => EPSS_PREFIX + c));
    const missing: string[] = [];
    cves.forEach((cve, i) => {
      const value = cached[i];
      if (value === null) missing.push(cve);
      else if (value !== 'none')
        result.set(cve, JSON.parse(value) as EpssScore);
    });

    for (let i = 0; i < missing.length; i += EPSS_BATCH) {
      const batch = missing.slice(i, i + EPSS_BATCH);
      const url = `${EPSS_URL}?cve=${batch.map(encodeURIComponent).join(',')}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`EPSS API returned ${response.status}`);
      const body = (await response.json()) as {
        data: { cve: string; epss: string; percentile: string }[];
      };
      const found = new Map(
        body.data.map((row) => [
          row.cve,
          { score: Number(row.epss), percentile: Number(row.percentile) },
        ]),
      );
      const write = this.redis.multi();
      for (const cve of batch) {
        const score = found.get(cve);
        if (score) result.set(cve, score);
        write.set(
          EPSS_PREFIX + cve,
          score ? JSON.stringify(score) : 'none',
          'EX',
          TTL_SECONDS,
        );
      }
      await write.exec();
    }
    return result;
  }
}
