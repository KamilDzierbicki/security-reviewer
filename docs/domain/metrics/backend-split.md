# Model metrics: backend module split

- Date: 2026-11-23
- Input: code in `backend/src` (import graph between folders, Nest modules, pipeline services), `docs/domain/model-review.md`
- Method: archetype skill, module model-metrics. Change scenarios written by hand from the README "next steps", not generated blind (change-simulator not run)
- Status: draft. Kamil chose to apply the fixes for A1, A3 and the S2 hotspot (model B); see "Applied" at the end

## 1. Applicable metrics

| Metric | Kept or dropped | Why |
|---|---|---|
| Change cost per scenario (files and modules touched) | Kept, leading | One author, so "teams touched" is always one. What a reviewer will test is "how do I add a scanner or a new kind of finding" |
| Arrow direction and cycles | Kept | Core domain (Risk) must not depend on infrastructure (Scanners), and cycles make the split hard to explain |
| Snapshot integrity of a finished result | Kept | The README promises that an old result stays the same after the rules change |
| Failure isolation | Kept | Partial results are a product feature (scanner, threat intel and LLM failures) |
| Teams touched per change, contract versioning, technology autonomy | Dropped | One person, one repository, no external consumers of events |

## 2. Change scenarios (hand-written)

| # | Change | Modules touched | Verdict |
|---|---|---|---|
| S1 | New scanner of an existing kind (for example Trivy or npm audit for dependencies) | scanners (adapter, parser, `SCANNER_CLASSES`), Dockerfile, env | Good: one module. Pipeline, job fan-out, scanner_runs and progress pick it up |
| S2 | New kind of finding (SAST "code", IaC "misconfiguration", container image) | scanners, risk (types, ruleset, grouping, fingerprint), scans view, frontend types and labels | Hotspot: 8 to 10 files in 4 places. Worse, three of them branch with `kind === 'dependency' ? ... : <secret>` and cast the evidence, so after the union type is widened the new kind is silently scored, grouped and advised as a secret ("revoke and rotate") |
| S3 | Private repositories through a GitHub App | repositories (client, installation), pipeline workspace (git auth), users | Expected spread for a new capability; no finding |
| S4 | Live verification of secrets (exploitable factor "confirmed") | pipeline analyze (enrich step is dependency-only), risk ruleset, a new verifier service | Acceptable; enrichment is a fixed step inside `AnalyzeService`, so a second enricher is an edit, not a plug-in |
| S5 | New ranking weights (ruleset v3) | risk only, plus the version string | Good for scores. But see finding A3: grouping, top-risk selection and action text are recomputed at read time with the current code, so old results change |
| S6 | Replace object storage or the queue (generic side) | storage only; queue: pipeline and scans | Good: generic modules do not know about specific ones |

## 3. Arrow findings

Import graph between folders, counted from the code.

| # | Arrow | Measure | Warning sign | Proposed fix |
|---|---|---|---|---|
| A1 | risk <-> scanners | Direction, cycle | Risk (core domain) imports `ScannerKind` from the scanner adapter interface; scanners import Risk types. The core depends on infrastructure for its own vocabulary | Move `ScannerKind` (rename to `FindingKind`) into `risk/risk.types.ts`; scanners depend on risk, never the other way |
| A2 | scans <-> pipeline | Cycle | `scans` imports the queue contract (`enqueuePrepare`, `SCAN_QUEUE`, `PROGRESS_CHANNEL`) from `pipeline/queues.ts`; pipeline imports scan entities | The queue contract belongs to neither side; acceptable at this size, or move `queues.ts` next to the scan entities as the contract scans owns |
| A3 | scans result view -> risk grouping | Snapshot integrity | `GET /scans/:id/result` regroups findings and recomputes top risks and action text with today's code. The LLM narratives are keyed by group id (a hash of the group key), so a change in grouping silently detaches them. Contradicts "an old result stays the same" | Store the top risks (with their action text) on the run at finalize; recompute only the full list, or say in the README that grouping is presentation |
| A4 | pipeline -> risk (issue tracking) | Depth | The core rule "fixed only if verified" (G3) lives as SQL inside `AnalyzeService.reconcileIssues`, an orchestration service, not in the Risk context | Extract a pure function in `risk/` (previous open and fixed issues, current fingerprints, verified kinds -> changes), unit-test it; the service only persists |
| A5 | scans, pipeline -> repositories, users tables | Depth | Services read other modules' tables through the global `DataSource` instead of the owning module's service | Acceptable for reads inside a row-locked transaction; document it as deliberate |
| A6 | risk <-> scans | Cycle | Only ORM relations (`ManyToOne` to `ScanRun`) | Normal for TypeORM entities; no action |

Scattered questions:

- "What should I fix first?" is answered in two places: `AnalyzeService` (for the summary input) and `ScansService.getResult` (for the screen). Same pure function, so the answers agree today; they diverge as soon as the code changes between scan and read (A3).
- "Is this issue fixed?" is answered by one place (`reconcileIssues`), good.

Autonomy kept:

- Failure isolation: good. A failed scanner gives `partial`; threat intel and the LLM degrade to "unavailable" and the template; storage cleanup failures go to the sweeper. Verified by hand on the running stack.

## 4. Tactical metrics

| Module | Class | Metric | Result |
|---|---|---|---|
| risk (ruleset, grouping) | Transformation | Independent change vectors per sub-step | Two vectors (dependency, secret) handled by binary if/else with casts. Fine for two kinds, wrong shape for the third (S2) |
| ScanRun | Small contention | Commands that must block each other; data locked per command | One active run per repository (partial unique index), attempt fencing (row lock). Narrow and correct; verified by hand (README), no automated test |
| pipeline | Integration | Retry and acknowledgment semantics; behaviour when the other side is down | At-least-once jobs, idempotent writes, sweeper for lost enqueues, failed jobs kept 7 days. No alerting on dead jobs (README scope) |
| scans result view | Presentation | Response size, rebuildable | Rebuilds from findings on every request; 259 KB for NodeGoat, no pagination (README scope) |

G3 granularity: "verified" is per kind, not per scanner. With two dependency scanners, if one fails and the other succeeds, issues only the failed one can see are marked fixed. Harmless with one scanner per kind; record it before adding S1.

## 5. Alternatives for the per-kind logic (the S2 hotspot)

| Model | Change cost for a new kind | Compiler finds every place | Code now | Verdict |
|---|---|---|---|---|
| A. Binary if/else with casts (current) | 8 to 10 files, 3 silent | No | 0 | Only safe with two kinds |
| B. Exhaustive `switch` on one `FindingKind` union with a `never` check, no evidence casts | Same files, none silent | Yes | About 30 lines | Recommended now |
| C. One `FindingPolicy` per kind (fingerprint, assess, group key, action), registered next to the scanner | Scanner module plus one policy file | Yes, by the interface | About 150 lines and a registry | When a third kind is actually planned |

## 6. Trade-off ledger (model B)

- Improves: a new kind cannot be scored or advised as a secret by accident; the compiler lists every place to update.
- Degrades: kind-specific logic stays spread across three files in `risk/`, so a new kind is still a multi-file change (C would fix that, at the cost of an abstraction with two implementations today).
- Worth it because the strategic direction (README next steps) is more kinds of checks, and a silent wrong action ("rotate this key" for a code finding) is the most damaging failure for a review product.

## 7. Open questions (default stands until answered)

1. Is a third kind of finding expected in the next iteration? Default: no, so model B, not C.
2. Should a finished result be frozen (A3)? Default: freeze the top risks only.
3. Per-kind or per-scanner verification (G3)? Default: per kind while there is one scanner per kind.

## Applied (2026-11-23)

- A1: `FindingKind` lives in `risk/risk.types.ts`; scanners, entities and the pipeline import it from Risk. The risk -> scanners arrow is gone.
- S2, model B: `ruleset.ts`, `risk-groups.ts`, `fingerprint.ts` and the frontend label switch exhaustively on the kind with a `never` check. Adding `'code'` to `FINDING_KINDS` was tried: the build failed at the three backend rule sites. Evidence casts remain inside the matching branch, because the evidence is stored as JSON. `risk/kinds.spec.ts` checks that an unknown kind stops the analysis instead of being scored as a secret.
- A3: the run stores `top_risks` (column in the single `InitialSchema` migration) at finalize; the result view reads it and recomputes only for older runs. Checked once against Postgres (scores changed after finalize, top risks and explanations stayed); there is no automated test for it. A `migration:generate` run against the migrated schema found no drift.
- Not applied, by choice: A2 (queue contract cycle).
- Later, during the NestJS review: issue tracking moved out of `AnalyzeService`: the rule is the pure function `diffIssues()` in `risk/issue-diff.ts` with unit tests (A4), and `pipeline/issue-tracker.ts` only loads and persists issues. The result screen moved to `ScanResultsService`, run reads to `ScanStatusService`; modules register their own repositories and the `DataSource` is left for the locked transactions (A5).
- Schema (2026-11-23): one `InitialSchema` migration generated from the entities (no drift), with indexes on every foreign key and a unique index on `lower(email)`. The sweeper's queries were checked with `EXPLAIN ANALYZE` on 50,000 runs: index scans on `scan_runs_owner_status`, 5 to 8 buffers, so no extra index.

## Re-check (2026-11-23, after the fixes)

Folder-level import graph counted again from `backend/src` (non-test files). Applied fixes hold: no `risk -> scanners` arrow, `risk` imports only entity types from `scans` and `repositories` (ORM relations, A6).

| # | Arrow | Measure | Finding | Verdict |
|---|---|---|---|---|
| R1 | repositories <-> scans | Cycle, depth | `RepositoriesService` reads the `ScanRun` table for "latest run per repository" on the list screen, while `ScansService` calls `RepositoriesService`. The upstream catalog knows the downstream scan table | Minor. Fix if touched: move the latest-run lookup into `ScanStatusService` and compose the list in the controller, so `repositories` no longer imports `scans` |
| R2 | users -> auth | Cycle (type only) | `UsersService` imports the `AuthUser` type from `auth` | Negligible. `AuthUser` could live in `users/`; no runtime coupling |
| R3 | scans <-> pipeline | Cycle | Unchanged A2: the queue contract in `pipeline/queues.ts` | Accepted, as before |
| R4 | config -> database, redis | Direction | `config/shared-modules.ts` wires TypeORM and Redis for both entrypoints | Fine: composition root, not configuration values |

No new scattered question; every module still has one problem class. Overall verdict unchanged: the split is sound, with R1 as the only arrow worth fixing.

Applied (2026-11-23): R1. `GET /repositories` (the list with the latest run) moved to `ScansController` and `ScanStatusService.listRepositoriesWithLatestRun`; `RepositoriesService.list` returns repositories only, and the shared response shape is `repositories/repository-view.ts`. `repositories` no longer imports anything from `scans`. Same URL and response; checked on the running stack (no run, then the active run).
