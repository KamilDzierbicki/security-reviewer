import { join } from 'node:path';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { EntityManager } from 'typeorm';
import { scanConfig } from '../config/namespaces.js';
import { Finding } from '../risk/finding.entity.js';
import { fingerprintOf } from '../risk/fingerprint.js';
import { CommandError } from '../scanners/run-command.js';
import { SCANNERS, type Scanner } from '../scanners/scanner.interface.js';
import { ScanStage } from '../scans/scan-stage.entity.js';
import { ScannerRun } from '../scans/scanner-run.entity.js';
import { ArtifactStorageService } from '../storage/artifact-storage.service.js';
import type { ScannerJobData } from './queues.js';
import { RunStateService } from './run-state.service.js';
import { ScanFailure } from './scan-failure.js';
import { createWorkspace, extractArchive } from './workspace.js';

@Injectable()
export class ScannerJobService {
  private readonly logger = new Logger(ScannerJobService.name);

  constructor(
    private readonly runState: RunStateService,
    private readonly storage: ArtifactStorageService,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
    @Inject(SCANNERS) private readonly scanners: Scanner[],
  ) {}

  async run({ runId, attempt, scanner: name }: ScannerJobData): Promise<void> {
    const scanner = this.scanners.find((s) => s.name === name);
    if (!scanner) throw new Error(`Unknown scanner ${name}`);

    const started = await this.runState.withAttempt(
      runId,
      attempt,
      async (m) => {
        if (!(await scanStageOpen(m, runId))) return false;
        await m.update(
          ScannerRun,
          { runId, scanner: name },
          { status: 'running', error: null, startedAt: new Date() },
        );
        return true;
      },
    );
    if (!started?.value) return;

    const workspace = await createWorkspace(this.scan.workdir);
    try {
      const archive = join(workspace.dir, 'snapshot.tar.gz');
      await this.storage.download(runId, attempt, archive);
      const maxBytes = this.scan.maxRepoSizeMb * 1024 * 1024;
      await extractArchive(archive, workspace.sourceDir, maxBytes);
      const detected = await scanner.scan({ rootDir: workspace.sourceDir });

      const byFingerprint = new Map(
        detected.map((f) => [fingerprintOf(f), f] as const),
      );
      await this.runState.withAttempt(runId, attempt, async (manager) => {
        if (!(await scanStageOpen(manager, runId))) return;
        const marked = await manager.update(
          ScannerRun,
          { runId, scanner: name, status: 'running' },
          {
            status: 'completed',
            findingCount: byFingerprint.size,
            finishedAt: new Date(),
          },
        );
        if (!marked.affected) return;
        const rows = [...byFingerprint].map(([fingerprint, f]) => ({
          runId,
          fingerprint,
          scanner: f.scanner,
          kind: f.kind,
          ruleId: f.ruleId.slice(0, 255),
          title: f.title.slice(0, 500),
          filePath: f.filePath.slice(0, 1024),
          reportedSeverity: f.reportedSeverity,
          evidence: f.evidence,
        }));
        for (let i = 0; i < rows.length; i += 500) {
          await manager
            .createQueryBuilder()
            .insert()
            .into(Finding)
            .values(rows.slice(i, i + 500))
            .orIgnore()
            .execute();
        }
      });
    } catch (error) {
      const message = publicMessage(error);
      this.logger.warn('Scanner failed', { runId, scanner: name, message });
      await this.runState.withAttempt(runId, attempt, async (m) => {
        if (!(await scanStageOpen(m, runId))) return;
        await m.update(
          ScannerRun,
          { runId, scanner: name, status: 'running' },
          {
            status: 'failed',
            error: `${name} failed: ${message}`,
            finishedAt: new Date(),
          },
        );
      });
      throw error;
    } finally {
      await workspace.cleanup();
    }
  }
}

async function scanStageOpen(
  manager: EntityManager,
  runId: string,
): Promise<boolean> {
  const stage = await manager.findOneBy(ScanStage, { runId, name: 'scan' });
  return stage?.status === 'running';
}

function publicMessage(error: unknown): string {
  if (error instanceof CommandError || error instanceof ScanFailure) {
    return error.message;
  }
  if (error instanceof SyntaxError) return 'returned output we could not read';
  return 'internal error';
}
