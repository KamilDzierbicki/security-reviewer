import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
} from 'typeorm';
import { ScanRun } from '../scans/scan-run.entity.js';
import type { FindingKind } from './risk.types.js';
import { Issue } from './issue.entity.js';
import type {
  DependencyEvidence,
  Factor,
  SecretEvidence,
  Severity,
} from './risk.types.js';

@Entity('findings')
@Index('findings_run_fingerprint', ['runId', 'fingerprint'], { unique: true })
@Index('findings_run_score', ['runId', 'riskScore'])
@Index('findings_issue', ['issueId'])
export class Finding {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'run_id', type: 'uuid' })
  runId: string;

  @ManyToOne(() => ScanRun, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run?: Relation<ScanRun>;

  @Column({ name: 'issue_id', type: 'uuid', nullable: true })
  issueId: string | null;

  @ManyToOne(() => Issue, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'issue_id' })
  issue?: Relation<Issue>;

  @Column({ type: 'char', length: 64 })
  fingerprint: string;

  @Column({ type: 'varchar', length: 64 })
  scanner: string;

  @Column({ type: 'varchar', length: 32 })
  kind: FindingKind;

  @Column({ name: 'rule_id', type: 'varchar', length: 255 })
  ruleId: string;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ name: 'file_path', type: 'varchar', length: 1024 })
  filePath: string;

  @Column({ name: 'reported_severity', type: 'varchar', length: 16 })
  reportedSeverity: Severity;

  @Column({
    name: 'final_severity',
    type: 'varchar',
    length: 16,
    nullable: true,
  })
  finalSeverity: Severity | null;

  @Column({ name: 'risk_score', type: 'int', nullable: true })
  riskScore: number | null;

  @Column({ type: 'jsonb', nullable: true })
  factors: Factor[] | null;

  @Column({ type: 'jsonb' })
  evidence: DependencyEvidence | SecretEvidence;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
