import { Module } from '@nestjs/common';
import { ThreatIntelService } from './threat-intel.service.js';

@Module({
  providers: [ThreatIntelService],
  exports: [ThreatIntelService],
})
export class ThreatIntelModule {}
