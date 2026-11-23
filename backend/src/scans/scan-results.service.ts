import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, Repository as OrmRepository } from 'typeorm';
import { Finding } from '../risk/finding.entity.js';
import { Issue } from '../risk/issue.entity.js';
import {
  buildRiskGroups,
  countBySeverity,
  type ScoredFinding,
} from '../risk/risk-groups.js';
import { ScanRun } from './scan-run.entity.js';
import { ScanStatusService } from './scan-status.service.js';
import { findingView, issueRefView } from './scan-views.js';
import { ACTIVE_RUN_STATUSES } from './scan.types.js';
import { selectTopRisks } from './top-risks.js';

@Injectable()
export class ScanResultsService {
  constructor(
    private readonly status: ScanStatusService,
    @InjectRepository(ScanRun) private readonly runs: OrmRepository<ScanRun>,
    @InjectRepository(Finding)
    private readonly findingRows: OrmRepository<Finding>,
    @InjectRepository(Issue) private readonly issues: OrmRepository<Issue>,
  ) {}

  async getResult(ownerId: string, runId: string) {
    const run = await this.status.getOwnedRun(ownerId, runId);
    if (ACTIVE_RUN_STATUSES.includes(run.status)) {
      throw new ConflictException('The scan is still running');
    }
    const status = await this.status.toStatusView(run);
    if (run.status === 'failed') {
      return {
        run: status,
        summary: null,
        topRisks: [],
        risks: [],
        changes: null,
        severityCounts: null,
      };
    }

    const findings = (await this.findingRows.findBy({
      runId,
    })) as ScoredFinding[] & Finding[];
    const groups = buildRiskGroups(findings);
    const top = run.topRisks ?? selectTopRisks(groups);
    const narratives = new Map(
      (run.summary?.risks ?? []).map((r) => [r.riskId, r]),
    );
    const byId = new Map(findings.map((f) => [f.id, f]));

    return {
      run: status,
      rulesetVersion: run.rulesetVersion,
      summary: run.summary && {
        source: run.summary.source,
        model: run.summary.model ?? null,
        headline: run.summary.headline,
        overview: run.summary.overview,
      },
      severityCounts: countBySeverity(groups),
      totals: { findings: findings.length, risks: groups.length },
      topRisks: top.map((group) => ({
        ...group,
        why: narratives.get(group.id)?.why ?? null,
        nextAction: narratives.get(group.id)?.nextAction ?? group.action,
      })),
      changes: await this.changesView(run),
      risks: groups.map((group) => ({
        ...group,
        findings: group.findingIds
          .map((id) => byId.get(id))
          .filter((f) => f !== undefined)
          .map(findingView),
      })),
    };
  }

  private async changesView(run: ScanRun) {
    if (!run.changes) return null;
    const { newIssueIds, fixedIssueIds, notVerifiedIssueIds } = run.changes;
    const reopenedIssueIds = run.changes.reopenedIssueIds ?? [];
    const ids = [
      ...newIssueIds,
      ...reopenedIssueIds,
      ...fixedIssueIds,
      ...notVerifiedIssueIds,
    ];
    const issues = ids.length ? await this.issues.findBy({ id: In(ids) }) : [];
    const byId = new Map(issues.map((i) => [i.id, i]));
    const pick = (list: string[]) =>
      list
        .map((id) => byId.get(id))
        .filter((i) => i !== undefined)
        .map(issueRefView);
    const gone = pick(fixedIssueIds);
    return {
      isFirstScan: await this.isFirstFinalizedRun(run),
      new: pick(newIssueIds),
      reopened: pick(reopenedIssueIds),
      fixed: gone.filter((i) => i.kind !== 'secret'),
      secretsRemovedFromCode: gone.filter((i) => i.kind === 'secret'),
      notVerified: pick(notVerifiedIssueIds),
    };
  }

  private async isFirstFinalizedRun(run: ScanRun): Promise<boolean> {
    const earlier = await this.runs.countBy({
      repositoryId: run.repositoryId,
      status: In(['completed', 'partial']),
      createdAt: LessThan(run.createdAt),
    });
    return earlier === 0;
  }
}
