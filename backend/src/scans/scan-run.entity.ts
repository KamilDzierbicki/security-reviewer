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
import type { RiskGroup } from '../risk/risk-groups.js';
import { User } from '../users/user.entity.js';
import type { RunSummary } from '../summary/summary.schema.js';
import type { RunChanges, ScanRunStatus } from './scan.types.js';

@Entity('scan_runs')
@Index('scan_runs_one_active_per_repository', ['repositoryId'], {
  unique: true,
  where: `status IN ('queued', 'running')`,
})
@Index('scan_runs_owner_status', ['ownerId', 'status'])
@Index('scan_runs_repository_created', ['repositoryId', 'createdAt'])
export class ScanRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'repository_id', type: 'uuid' })
  repositoryId: string;

  @ManyToOne(() => Repository, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'repository_id' })
  repository?: Relation<Repository>;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: Relation<User>;

  @Column({ type: 'varchar', length: 16, default: 'queued' })
  status: ScanRunStatus;

  @Column({ name: 'commit_sha', type: 'varchar', length: 40, nullable: true })
  commitSha: string | null;

  @Column({ type: 'int', default: 0 })
  attempt: number;

  @Column({
    name: 'ruleset_version',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  rulesetVersion: string | null;

  @Column({ type: 'jsonb', nullable: true })
  summary: RunSummary | null;

  @Column({ name: 'top_risks', type: 'jsonb', nullable: true })
  topRisks: RiskGroup[] | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: RunChanges | null;

  @Column({ type: 'text', nullable: true })
  error: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
