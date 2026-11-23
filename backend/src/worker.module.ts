import { Module } from '@nestjs/common';
import { sharedModules } from './config/shared-modules.js';
import { PipelineModule } from './pipeline/pipeline.module.js';

@Module({
  imports: [...sharedModules({ runMigrations: false }), PipelineModule],
})
export class WorkerModule {}
