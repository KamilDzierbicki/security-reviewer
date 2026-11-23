import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Relation,
} from 'typeorm';
import { Repository } from '../repositories/repository.entity.js';
import { ScanRun } from '../scans/scan-run.entity.js';
import type { FindingKind } from './risk.types.js';

export type IssueStatus = 'open' | 'fixed';

@Entity('issues')
@Index('issues_repository_fingerprint', ['repositoryId', 'fingerprint'], {
  unique: true,
})
@Index('issues_first_seen_run', ['firstSeenRunId'])
@Index('issues_last_seen_run', ['lastSeenRunId'])
@Index('issues_fixed_in_run', ['fixedInRunId'])
export class Issue {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository?: Relation<Repository>;

  @Column({ type: 'char', length: 64 })
  fingerprint: string;

  @Column({ type: 'varchar', length: 32 })
  kind: FindingKind;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'varchar', length: 16, default: 'open' })
  status: IssueStatus;

  @Column({ name: 'first_seen_run_id', type: 'uuid' })
  firstSeenRunId: string;

  @ManyToOne(() => ScanRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'first_seen_run_id' })
  firstSeenRun?: Relation<ScanRun>;

  @Column({ name: 'last_seen_run_id', type: 'uuid' })
  lastSeenRunId: string;

  @ManyToOne(() => ScanRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'last_seen_run_id' })
  lastSeenRun?: Relation<ScanRun>;

  @Column({ name: 'fixed_in_run_id', type: 'uuid', nullable: true })
  fixedInRunId: string | null;

  @ManyToOne(() => ScanRun, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fixed_in_run_id' })
  fixedInRun?: Relation<ScanRun>;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
