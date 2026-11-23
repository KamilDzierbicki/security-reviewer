import { Repository } from '../repositories/repository.entity.js';
import { Finding } from '../risk/finding.entity.js';
import { Issue } from '../risk/issue.entity.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import { ScanStage } from '../scans/scan-stage.entity.js';
import { ScannerRun } from '../scans/scanner-run.entity.js';
import { User } from '../users/user.entity.js';

export const ENTITIES = [
  User,
  Repository,
  ScanRun,
  ScanStage,
  ScannerRun,
  Finding,
  Issue,
];
