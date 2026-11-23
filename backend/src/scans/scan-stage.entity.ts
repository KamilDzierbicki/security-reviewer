import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ScanRun } from './scan-run.entity.js';
import type { StageName, StageStatus } from './scan.types.js';

@Entity('scan_stages')
@Index('scan_stages_run_name', ['runId', 'name'], { unique: true })
export class ScanStage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => ScanRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run?: Relation<ScanRun>;

  @Column({ type: 'varchar', length: 32 })
  name: StageName;

  @Column({ type: 'int' })
  position: number;

  @Column({ type: 'varchar', length: 16, default: 'pending' })
  status: StageStatus;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;
}
