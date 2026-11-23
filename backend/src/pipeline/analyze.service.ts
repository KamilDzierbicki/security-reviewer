import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository as OrmRepository } from 'typeorm';
import { Finding } from '../risk/finding.entity.js';
import {
  buildRiskGroups,
  countBySeverity,
  type ScoredFinding,
} from '../risk/risk-groups.js';
import type { DependencyEvidence } from '../risk/risk.types.js';
import { assess, RULESET_VERSION } from '../risk/ruleset.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ScanStage } from '../scans/scan-stage.entity.js';
import { ScannerRun } from '../scans/scanner-run.entity.js';
import { selectTopRisks } from '../scans/top-risks.js';
import { ArtifactStorageService } from '../storage/artifact-storage.service.js';
import { SummaryService } from '../summary/summary.service.js';
import {
  ThreatIntelService,
  withThreatIntel,
} from '../threat-intel/threat-intel.service.js';
import { IssueTracker } from './issue-tracker.js';
import type { AnalyzeJobData } from './queues.js';
import { RunStateService } from './run-state.service.js';

@Injectable()
export class AnalyzeService {
  private readonly logger = new Logger(AnalyzeService.name);

  constructor(
    private readonly runState: RunStateService,
    @InjectRepository(Finding)
    private readonly findingRows: OrmRepository<Finding>,
    @InjectRepository(ScanRun) private readonly runs: OrmRepository<ScanRun>,
    private readonly threatIntel: ThreatIntelService,
    private readonly summary: SummaryService,
    private readonly issues: IssueTracker,
    private readonly storage: ArtifactStorageService,
  ) {}

  async analyze({ runId, attempt }: AnalyzeJobData): Promise<void> {
    const outcome = await this.closeScanStage(runId, attempt);
    if (!outcome) return;
    const { failed, verifiedKinds } = outcome;
    if (verifiedKinds.length === 0) {
      await this.runState.fail(
        runId,
        attempt,
        `All scanners failed. ${failed.map((s) => s.error).join(' ')}`.trim(),
      );
      await this.deleteArtifact(runId, attempt);
      return;
    }
    const partialReason =
      failed.length > 0
        ? `${failed.map((s) => s.scanner).join(', ')} did not complete, so its results are missing and its earlier issues are marked "not verified".`
        : null;
    await this.runState.setStage(
      runId,
      attempt,
      'scan',
      'completed',
      partialReason,
    );

    const findings = await this.findingRows.findBy({ runId });
    await this.enrich(runId, attempt, findings);
    await this.prioritize(runId, attempt, findings);

    await this.runState.setStage(runId, attempt, 'summarize', 'running');
    const run = await this.runs.findOneOrFail({
      where: { id: runId },
      relations: { repository: true },
    });
    const groups = buildRiskGroups(findings as ScoredFinding[]);
    const topRisks = selectTopRisks(groups);
    const summary = await this.summary.summarize({
      repositoryName: run.repository!.fullName,
      totalFindings: findings.length,
      riskCount: groups.length,
      severityCounts: countBySeverity(groups),
      topRisks,
      partialReason,
    });

    const finalized = await this.runState.withAttempt(
      runId,
      attempt,
      async (manager) => {
        const changes = await this.issues.reconcile(
          manager,
          run,
          verifiedKinds,
        );
        await manager.update(
          ScanStage,
          { runId, status: In(['pending', 'running']) },
          { status: 'completed', finishedAt: new Date() },
        );
        await manager.update(
          ScanRun,
          { id: runId },
          {
            status: failed.length > 0 ? 'partial' : 'completed',
            rulesetVersion: RULESET_VERSION,
            summary,
            topRisks,
            changes,
            error: partialReason,
            finishedAt: new Date(),
          },
        );
      },
    );
    if (finalized) await this.deleteArtifact(runId, attempt);
  }

  private async closeScanStage(runId: string, attempt: number) {
    const scannerRuns = await this.runState.withAttempt(
      runId,
      attempt,
      async (manager) => {
        await manager.update(
          ScannerRun,
          { runId, status: Not('completed') },
          {
            status: 'failed',
            finishedAt: new Date(),
            error: () => `COALESCE(error, 'Scanner did not finish')`,
          },
        );
        await manager.update(
          ScanStage,
          { runId, name: 'scan' },
          { status: 'completed', finishedAt: new Date() },
        );
        return manager.findBy(ScannerRun, { runId });
      },
    );
    if (!scannerRuns) return null;
    return {
      failed: scannerRuns.value.filter((s) => s.status === 'failed'),
      verifiedKinds: [
        ...new Set(
          scannerRuns.value
            .filter((s) => s.status === 'completed')
            .map((s) => s.kind),
        ),
      ],
    };
  }

  private async enrich(
    runId: string,
    attempt: number,
    findings: Finding[],
  ): Promise<void> {
    await this.runState.setStage(runId, attempt, 'enrich', 'running');
    const dependencies = findings.filter((f) => f.kind === 'dependency');
    const intel = await this.threatIntel.lookup(
      dependencies.flatMap((f) =>
        (f.evidence as DependencyEvidence).aliases.filter((a) =>
          a.startsWith('CVE-'),
        ),
      ),
    );
    for (const finding of dependencies) {
      finding.evidence = withThreatIntel(
        finding.evidence as DependencyEvidence,
        intel,
      );
    }
    await this.saveFindings(runId, attempt, dependencies);
    await this.runState.setStage(
      runId,
      attempt,
      'enrich',
      'completed',
      intel.available
        ? null
        : 'Threat intel was unavailable; exploitability is not scored for this run.',
    );
  }

  private async prioritize(
    runId: string,
    attempt: number,
    findings: Finding[],
  ): Promise<void> {
    await this.runState.setStage(runId, attempt, 'prioritize', 'running');
    for (const finding of findings) {
      const result = assess(finding);
      finding.finalSeverity = result.finalSeverity;
      finding.riskScore = result.riskScore;
      finding.factors = result.factors;
    }
    await this.saveFindings(runId, attempt, findings);
    await this.runState.setStage(runId, attempt, 'prioritize', 'completed');
  }

  private async saveFindings(
    runId: string,
    attempt: number,
    findings: Finding[],
  ): Promise<void> {
    await this.runState.withAttempt(runId, attempt, (manager) =>
      manager.save(Finding, findings, { chunk: 200 }),
    );
  }

  private async deleteArtifact(runId: string, attempt: number): Promise<void> {
    try {
      await this.storage.delete(this.storage.keyFor(runId, attempt));
    } catch (error) {
      this.logger.warn('Could not delete artifact', {
        runId,
        error: String(error),
      });
    }
  }
}
