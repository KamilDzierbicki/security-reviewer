import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from '../repositories/repository.entity.js';
import { Finding } from '../risk/finding.entity.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ScannersModule } from '../scanners/scanners.module.js';
import { StorageModule } from '../storage/storage.module.js';
import { SummaryModule } from '../summary/summary.module.js';
import { ThreatIntelModule } from '../threat-intel/threat-intel.module.js';
import { AnalyzeService } from './analyze.service.js';
import { IssueTracker } from './issue-tracker.js';
import { MaintenanceProcessor } from './maintenance.processor.js';
import { PrepareService } from './prepare.service.js';
import { ProgressPublisher } from './progress.publisher.js';
import {
  MAINTENANCE_QUEUE,
  SCAN_FLOW_PRODUCER,
  SCAN_QUEUE,
  SCANNER_QUEUE,
} from './queues.js';
import { RunStateService } from './run-state.service.js';
import { ScanProcessor } from './scan.processor.js';
import { ScannerJobService } from './scanner-job.service.js';
import { ScannerProcessor } from './scanner.processor.js';
import { SweeperService } from './sweeper.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([ScanRun, Finding, Repository]),
    BullModule.registerQueue(
      { name: SCAN_QUEUE },
      { name: SCANNER_QUEUE },
      { name: MAINTENANCE_QUEUE },
    ),
    BullModule.registerFlowProducer({ name: SCAN_FLOW_PRODUCER }),
    ScannersModule,
    StorageModule,
    ThreatIntelModule,
    SummaryModule,
  ],
  providers: [
    ProgressPublisher,
    RunStateService,
    PrepareService,
    ScannerJobService,
    AnalyzeService,
    IssueTracker,
    SweeperService,
    ScanProcessor,
    ScannerProcessor,
    MaintenanceProcessor,
  ],
})
export class PipelineModule {}
