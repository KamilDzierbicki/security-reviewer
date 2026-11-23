import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import type { FindingKind } from '../risk/risk.types.js';
import { ScanRun } from './scan-run.entity.js';
import type { ScannerRunStatus } from './scan.types.js';

@Entity('scanner_runs')
@Index('scanner_runs_run_scanner', ['runId', 'scanner'], { unique: true })
export class ScannerRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => ScanRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run?: Relation<ScanRun>;

  @Column({ type: 'varchar', length: 64 })
  scanner: string;

  @Column({ type: 'varchar', length: 32 })
  kind: FindingKind;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: ScannerRunStatus;

  @Column({ name: 'finding_count', type: 'int', nullable: true })
  findingCount: number | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
