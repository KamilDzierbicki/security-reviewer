import type { DetectedFinding, FindingKind } from '../risk/risk.types.js';

export interface ScanContext {
  rootDir: string;
}

export interface Scanner {
  readonly name: string;
  readonly kind: FindingKind;
  scan(context: ScanContext): Promise<DetectedFinding[]>;
}

export const SCANNERS = Symbol('SCANNERS');
