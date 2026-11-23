import { join } from 'node:path';
import { InjectFlowProducer } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { FlowProducer } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository as OrmRepository } from 'typeorm';
import { scanConfig } from '../config/namespaces.js';
import { Repository } from '../repositories/repository.entity.js';
import { SCANNERS, type Scanner } from '../scanners/scanner.interface.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ArtifactStorageService } from '../storage/artifact-storage.service.js';
import { buildScanFlow, SCAN_FLOW_PRODUCER } from './queues.js';
import { RunStateService } from './run-state.service.js';
import {
  assertSizeWithin,
  createWorkspace,
  fetchCommit,
  packDirectory,
  resolveHeadCommit,
} from './workspace.js';

@Injectable()
export class PrepareService {
  private readonly logger = new Logger(PrepareService.name);

  constructor(
    private readonly runState: RunStateService,
    private readonly storage: ArtifactStorageService,
    @InjectRepository(Repository)
    private readonly repositories: OrmRepository<Repository>,
    @Inject(scanConfig.KEY)
    private readonly scan: ConfigType<typeof scanConfig>,
    @Inject(SCANNERS) private readonly scanners: Scanner[],
    @InjectFlowProducer(SCAN_FLOW_PRODUCER)
    private readonly flowProducer: FlowProducer,
  ) {}

  async prepare(runId: string): Promise<void> {
    const active = await this.runState.begin(runId);
    if (!active) {
      this.logger.log('Run is no longer active, skipping', { runId });
      return;
    }
    const { run, attempt } = active;
    await this.runState.setStage(runId, attempt, 'clone', 'running');

    const repository = await this.repositories.findOneByOrFail({
      id: run.repositoryId,
    });
    const workspace = await createWorkspace(this.scan.workdir);
    try {
      const sha =
        run.commitSha ??
        (await resolveHeadCommit(repository.fullName, workspace.dir));
      await this.runState.withAttempt(runId, attempt, (manager) =>
        manager.update(ScanRun, { id: runId }, { commitSha: sha }),
      );

      await fetchCommit(workspace, repository.fullName, sha);
      const maxBytes = this.scan.maxRepoSizeMb * 1024 * 1024;
      await assertSizeWithin(workspace.sourceDir, maxBytes);
      const archive = join(workspace.dir, 'snapshot.tar.gz');
      await packDirectory(workspace.sourceDir, archive);
      const owned = await this.runState.withAttempt(runId, attempt, () =>
        Promise.resolve(),
      );
      if (!owned) return;
      await this.storage.upload(runId, attempt, archive);
    } finally {
      await workspace.cleanup();
    }

    const stillActive = await this.runState.setStage(
      runId,
      attempt,
      'clone',
      'completed',
    );
    if (!stillActive) return;
    await this.runState.setStage(runId, attempt, 'scan', 'running');
    await this.flowProducer.add(buildScanFlow(runId, attempt, this.scanners));
  }
}
