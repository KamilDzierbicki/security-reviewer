import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { Finding } from '../risk/finding.entity.js';
import { diffIssues } from '../risk/issue-diff.js';
import { Issue } from '../risk/issue.entity.js';
import type { FindingKind } from '../risk/risk.types.js';
import type { ScanRun } from '../scans/scan-run.entity.js';
import type { RunChanges } from '../scans/scan.types.js';

@Injectable()
export class IssueTracker {
  async reconcile(
    manager: EntityManager,
    run: ScanRun,
    verifiedKinds: FindingKind[],
  ): Promise<RunChanges> {
    const findings = await manager.findBy(Finding, { runId: run.id });
    const before = await manager.findBy(Issue, {
      repositoryId: run.repositoryId,
    });
    const { reopened, fixed, notVerified } = diffIssues(
      before,
      new Set(findings.map((f) => f.fingerprint)),
      verifiedKinds,
    );

    if (findings.length > 0) {
      await this.upsertOpen(manager, run, findings);
      await this.linkFindings(manager, run);
    }

    if (fixed.length > 0) {
      await manager.update(
        Issue,
        fixed.map((i) => i.id),
        { status: 'fixed', fixedInRunId: run.id },
      );
    }
    const created = await manager.findBy(Issue, {
      repositoryId: run.repositoryId,
      firstSeenRunId: run.id,
    });
    return {
      newIssueIds: created.map((i) => i.id),
      reopenedIssueIds: reopened.map((i) => i.id),
      fixedIssueIds: fixed.map((i) => i.id),
      notVerifiedIssueIds: notVerified.map((i) => i.id),
    };
  }

  private async upsertOpen(
    manager: EntityManager,
    run: ScanRun,
    findings: Finding[],
  ): Promise<void> {
    const rows = findings.map((f) => ({
      repositoryId: run.repositoryId,
      fingerprint: f.fingerprint,
      kind: f.kind,
      title: f.title,
      status: 'open' as const,
      firstSeenRunId: run.id,
      lastSeenRunId: run.id,
      fixedInRunId: null,
    }));
    for (let i = 0; i < rows.length; i += 500) {
      await manager
        .createQueryBuilder()
        .insert()
        .into(Issue)
        .values(rows.slice(i, i + 500))
        .orUpdate(
          ['title', 'status', 'last_seen_run_id', 'fixed_in_run_id'],
          ['repository_id', 'fingerprint'],
        )
        .execute();
    }
  }

  private async linkFindings(
    manager: EntityManager,
    run: ScanRun,
  ): Promise<void> {
    await manager.query(
      `UPDATE findings f SET issue_id = i.id
       FROM issues i
       WHERE f.run_id = $1 AND i.repository_id = $2 AND i.fingerprint = f.fingerprint`,
      [run.id, run.repositoryId],
    );
  }
}
