import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SCAN_QUEUE } from '../pipeline/queues.js';
import { RepositoriesModule } from '../repositories/repositories.module.js';
import { Repository } from '../repositories/repository.entity.js';
import { Finding } from '../risk/finding.entity.js';
import { Issue } from '../risk/issue.entity.js';
import { ProgressSubscriber } from './progress.subscriber.js';
import { ScanRun } from './scan-run.entity.js';
import { ScanStage } from './scan-stage.entity.js';
import { ScannerRun } from './scanner-run.entity.js';
import { ScansController } from './scans.controller.js';
import { ScanResultsService } from './scan-results.service.js';
import { ScanStatusService } from './scan-status.service.js';
import { ScansService } from './scans.service.js';

@Module({
  imports: [
    RepositoriesModule,
    BullModule.registerQueue({ name: SCAN_QUEUE }),
    TypeOrmModule.forFeature([
      ScanRun,
      ScanStage,
      ScannerRun,
      Finding,
      Issue,
      Repository,
    ]),
  ],
  controllers: [ScansController],
  providers: [
    ScansService,
    ScanStatusService,
    ScanResultsService,
    ProgressSubscriber,
  ],
})
export class ScansModule {}
