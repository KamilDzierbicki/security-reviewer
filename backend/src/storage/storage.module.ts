import { Module } from '@nestjs/common';
import { ArtifactStorageService } from './artifact-storage.service.js';

@Module({
  providers: [ArtifactStorageService],
  exports: [ArtifactStorageService],
})
export class StorageModule {}
