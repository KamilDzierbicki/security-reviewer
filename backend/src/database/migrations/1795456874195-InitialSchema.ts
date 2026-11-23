import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1795456874195 implements MigrationInterface {
  name = 'InitialSchema1795456874195';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(254) NOT NULL, "password_hash" character varying(100) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "users_email_lower" ON "users" (lower("email"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "repositories" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "owner_id" uuid NOT NULL, "full_name" character varying(140) NOT NULL, "default_branch" character varying(255) NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ef0c358c04b4f4d29b8ca68ddff" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "repositories_owner_full_name" ON "repositories"  ("owner_id", "full_name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scan_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repository_id" uuid NOT NULL, "owner_id" uuid NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'queued', "commit_sha" character varying(40), "attempt" integer NOT NULL DEFAULT '0', "ruleset_version" character varying(32), "summary" jsonb, "top_risks" jsonb, "changes" jsonb, "error" text, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_dfa54d6ed31827275b98e560942" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "scan_runs_repository_created" ON "scan_runs"  ("repository_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "scan_runs_owner_status" ON "scan_runs"  ("owner_id", "status") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "scan_runs_one_active_per_repository" ON "scan_runs"  ("repository_id") WHERE status IN ('queued', 'running')`,
    );
    await queryRunner.query(
      `CREATE TABLE "issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "repository_id" uuid NOT NULL, "fingerprint" character(64) NOT NULL, "kind" character varying(32) NOT NULL, "title" character varying(500) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'open', "first_seen_run_id" uuid NOT NULL, "last_seen_run_id" uuid NOT NULL, "fixed_in_run_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9d8ecbbeff46229c700f0449257" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "issues_fixed_in_run" ON "issues"  ("fixed_in_run_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "issues_last_seen_run" ON "issues"  ("last_seen_run_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "issues_first_seen_run" ON "issues"  ("first_seen_run_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "issues_repository_fingerprint" ON "issues"  ("repository_id", "fingerprint") `,
    );
    await queryRunner.query(
      `CREATE TABLE "findings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "issue_id" uuid, "fingerprint" character(64) NOT NULL, "scanner" character varying(64) NOT NULL, "kind" character varying(32) NOT NULL, "rule_id" character varying(255) NOT NULL, "title" character varying(500) NOT NULL, "file_path" character varying(1024) NOT NULL, "reported_severity" character varying(16) NOT NULL, "final_severity" character varying(16), "risk_score" integer, "factors" jsonb, "evidence" jsonb NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ae9807d6293c23c13ff8804d09c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "findings_issue" ON "findings"  ("issue_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "findings_run_score" ON "findings"  ("run_id", "risk_score") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "findings_run_fingerprint" ON "findings"  ("run_id", "fingerprint") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scan_stages" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "name" character varying(32) NOT NULL, "position" integer NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "error" text, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_7708cbe2c8c6f2191b903c8a54f" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "scan_stages_run_name" ON "scan_stages"  ("run_id", "name") `,
    );
    await queryRunner.query(
      `CREATE TABLE "scanner_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "run_id" uuid NOT NULL, "scanner" character varying(64) NOT NULL, "kind" character varying(32) NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'pending', "finding_count" integer, "error" text, "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1ca5e1ade22c01136a0d6a8b0cb" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "scanner_runs_run_scanner" ON "scanner_runs"  ("run_id", "scanner") `,
    );
    await queryRunner.query(
      `ALTER TABLE "repositories" ADD CONSTRAINT "FK_9af57d895c4c3efb1d5e008ac07" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ADD CONSTRAINT "FK_c46ae6e2c3a955f0592375988fb" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" ADD CONSTRAINT "FK_31caab6afd0b4c4ffc03ccca32a" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_7f2adea8dbcb12dc266a1eab763" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_3af18b1ce03a771356f0ccb92e8" FOREIGN KEY ("first_seen_run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_2808b03f75fceb3933bc7ea56b9" FOREIGN KEY ("last_seen_run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" ADD CONSTRAINT "FK_eec82cc2015e1207b67f4b4d449" FOREIGN KEY ("fixed_in_run_id") REFERENCES "scan_runs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "findings" ADD CONSTRAINT "FK_6ad2923bf3d160f8a6d5018f588" FOREIGN KEY ("run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "findings" ADD CONSTRAINT "FK_99a067d8c2c7916a152c3e605d7" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_stages" ADD CONSTRAINT "FK_0d75db20b509ea72ac94b7d7d69" FOREIGN KEY ("run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "scanner_runs" ADD CONSTRAINT "FK_e7ea531e47c60ae416cc8482e17" FOREIGN KEY ("run_id") REFERENCES "scan_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "scanner_runs" DROP CONSTRAINT "FK_e7ea531e47c60ae416cc8482e17"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_stages" DROP CONSTRAINT "FK_0d75db20b509ea72ac94b7d7d69"`,
    );
    await queryRunner.query(
      `ALTER TABLE "findings" DROP CONSTRAINT "FK_99a067d8c2c7916a152c3e605d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "findings" DROP CONSTRAINT "FK_6ad2923bf3d160f8a6d5018f588"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_eec82cc2015e1207b67f4b4d449"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_2808b03f75fceb3933bc7ea56b9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_3af18b1ce03a771356f0ccb92e8"`,
    );
    await queryRunner.query(
      `ALTER TABLE "issues" DROP CONSTRAINT "FK_7f2adea8dbcb12dc266a1eab763"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" DROP CONSTRAINT "FK_31caab6afd0b4c4ffc03ccca32a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "scan_runs" DROP CONSTRAINT "FK_c46ae6e2c3a955f0592375988fb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "repositories" DROP CONSTRAINT "FK_9af57d895c4c3efb1d5e008ac07"`,
    );
    await queryRunner.query(`DROP INDEX "public"."scanner_runs_run_scanner"`);
    await queryRunner.query(`DROP TABLE "scanner_runs"`);
    await queryRunner.query(`DROP INDEX "public"."scan_stages_run_name"`);
    await queryRunner.query(`DROP TABLE "scan_stages"`);
    await queryRunner.query(`DROP INDEX "public"."findings_run_fingerprint"`);
    await queryRunner.query(`DROP INDEX "public"."findings_run_score"`);
    await queryRunner.query(`DROP INDEX "public"."findings_issue"`);
    await queryRunner.query(`DROP TABLE "findings"`);
    await queryRunner.query(
      `DROP INDEX "public"."issues_repository_fingerprint"`,
    );
    await queryRunner.query(`DROP INDEX "public"."issues_first_seen_run"`);
    await queryRunner.query(`DROP INDEX "public"."issues_last_seen_run"`);
    await queryRunner.query(`DROP INDEX "public"."issues_fixed_in_run"`);
    await queryRunner.query(`DROP TABLE "issues"`);
    await queryRunner.query(
      `DROP INDEX "public"."scan_runs_one_active_per_repository"`,
    );
    await queryRunner.query(`DROP INDEX "public"."scan_runs_owner_status"`);
    await queryRunner.query(
      `DROP INDEX "public"."scan_runs_repository_created"`,
    );
    await queryRunner.query(`DROP TABLE "scan_runs"`);
    await queryRunner.query(
      `DROP INDEX "public"."repositories_owner_full_name"`,
    );
    await queryRunner.query(`DROP TABLE "repositories"`);
    await queryRunner.query(`DROP INDEX "public"."users_email_lower"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
