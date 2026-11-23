import { Module, type Type } from '@nestjs/common';
import { GitleaksScanner } from './gitleaks.scanner.js';
import { OsvScanner } from './osv.scanner.js';
import { SCANNERS, type Scanner } from './scanner.interface.js';

export const SCANNER_CLASSES: Type<Scanner>[] = [OsvScanner, GitleaksScanner];

export function scannerProviders(classes: Type<Scanner>[]) {
  return [
    ...classes,
    {
      provide: SCANNERS,
      useFactory: (...scanners: Scanner[]) => scanners,
      inject: classes,
    },
  ];
}

@Module({
  providers: scannerProviders(SCANNER_CLASSES),
  exports: [SCANNERS],
})
export class ScannersModule {}
