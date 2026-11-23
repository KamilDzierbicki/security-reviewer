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
import { User } from '../users/user.entity.js';

@Entity('repositories')
@Index('repositories_owner_full_name', ['ownerId', 'fullName'], {
  unique: true,
})
export class Repository {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner?: Relation<User>;

  @Column({ name: 'full_name', type: 'varchar', length: 140 })
  fullName: string;

  @Column({ name: 'default_branch', type: 'varchar', length: 255 })
  defaultBranch: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
