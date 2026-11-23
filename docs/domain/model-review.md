# Model review: AI Scan Review Experience

- Date: 2026-11-23
- Input: code scanner app, planning decisions made in chat with Kamil (no code yet)
- Method: archetype skill, modules requirements-gate (pre-flight + gap scan), problem-classifier, context-distiller (light), aggregate-designer (light), integration. The 14-archetype scanner, formal verification and change simulation were not run (cost vs value for a home assignment); archetype fit below is a manual check and may miss a pattern.
- Status: draft, nothing here is agreed until Kamil confirms

## 1. Pre-flight verdict

| Question | Answer |
|---|---|
| Lifecycle | Production (treated as a product, not a throwaway) |
| Scope | Free hand |
| Complexity | Yes, clearly |

Verdict: **Proceed**. Note: the deliverable is a ~3 h assignment, so every mechanism below is ranked by "must have" vs "README next step".

## 2. Requirements as planned

1. User registers and logs in with email and password (JWT).
2. User adds a public GitHub repository URL.
3. User clicks "Scan latest" at any time.
4. A scan pins the commit SHA, shallow clones it once, stores a transient artifact in local S3 (RustFS via compose), and fans out to scanners on separate workers.
5. Scanners: OSV-Scanner (dependencies), Gitleaks (secrets), extensible `Scanner` interface.
6. Enrichment: EPSS, CISA KEV, direct vs transitive, prod vs dev, secret type and location.
7. Prioritization: reported severity to final severity with Reachable / Exploitable / Damage factors.
8. LLM summary and next actions, schema-validated, cites only given ids, deterministic fallback.
9. Progress over SSE; result page; diff vs previous scan (new / fixed).
10. Source code is never kept after the scan; we keep repository metadata, scan workflow data and findings (secrets masked).

## 3. Gaps and contradictions found

| # | Finding | Proposed default |
|---|---|---|
| G1 | Contradiction: "clone per scan, keep no code" vs "store the clone once in S3 and fan out". | Both hold if the S3 object is transient: one tarball per scan, deleted at finalize, bucket expiry as a safety net. Code at rest only for the scan's lifetime. |
| G2 | Two "Scan latest" clicks (or two tabs) start two scans of one repo; the diff "vs previous" becomes ambiguous when they finish out of order. | Invariant: at most one active scan per repository. A second click returns the active scan (idempotent). |
| G3 | A scanner fails in the new scan; its old findings would show as "fixed". | An issue becomes `fixed` only when a scanner of the same kind completed successfully in the new scan; otherwise `not verified`. |
| G4 | No definition of "the same finding" across scans; line numbers shift. | Fingerprint: dependency = ecosystem + package + vulnerability id + manifest path; secret = rule id + file path + hash of the secret value. Never line numbers. |
| G5 | EPSS and KEV change daily; old results would silently change if recomputed. | Store the enrichment values and the scoring ruleset version with each finding as a labeled snapshot of that scan. |
| G6 | Gitleaks output contains the raw secret. | Mask before persisting; store only a hash for the fingerprint. Test it. |
| G7 | Repo becomes private or deleted between "add" and "rescan". | Clone stage fails with a named, user-facing reason. |
| G8 | Same repo added by two users. | Repository is owned per user; every query filters by owner. No sharing. |
| G9 | Auth scope undefined: refresh tokens, password reset, login rate limit. | Short-lived access token, no refresh, no reset (README: out of scope), rate limit on login. |
| G10 | Limits per user were mentioned ("size per user") but not defined. | Max repo size, max active scans per user; reject with a clear reason. |

## 4. Problem classes

| Requirement | Class | Why | Consequence |
|---|---|---|---|
| Register, login | CRUD | Unique email is a DB constraint, nothing else checks shared state | Controller + service, no domain model |
| Add repository | CRUD with validation | URL format, github.com only, unique per owner | No aggregate |
| Start scan ("Scan latest") | Resource contention (small) | "Can I start?" depends on whether another request just started one (G2) | Guard in the database, see section 6 |
| Scan pipeline | Integration | API, queue, workers, RustFS, GitHub, OSV, EPSS, KEV, LLM; partial failure matters | Section 7 |
| Prioritization, summary input | Transformation | Pure function over findings, writes nothing itself | Unit-tested pure functions |
| Result page, diff, progress | Transformation and presentation | Projection of scan, stages and issues | Rebuildable read model, never a source of truth |

## 5. Contexts and vocabulary

| Context | Owns | Kind |
|---|---|---|
| Identity | User, credentials | Generic |
| Repository catalog | Repository (owner, URL, default branch) | Supporting, CRUD |
| Scan orchestration | ScanRun, Stage, ScannerRun, artifact reference, attempt | Core process |
| Risk | Issue, Finding, fingerprint, factors, final severity, scoring ruleset version | **Core domain** (where the product differentiates) |
| Threat intel | EPSS and KEV cache | Generic, reference data |
| Review | LLM summary, next actions | Supporting, projection over Risk |

Ambiguities to fix in code names:

- **"Scan"** means two things: the user's run (`ScanRun`) and one tool execution inside it (`ScannerRun`).
- **"Severity"** means three things: `reportedSeverity` (from the tool), `finalSeverity` (ours), and EPSS probability (an input factor, not a severity).
- **Finding vs Issue (most important change):** a `Finding` is one detection in one scan run. An `Issue` is the tracked problem across runs of one repository, keyed by fingerprint (the "active issue" idea). The diff "new / fixed" lives on `Issue` (first seen run, last seen run), not on findings. Without `Issue` the diff is a fragile comparison of two lists.

Single source of truth: "last scan of a repository" is a query, not a column copied onto Repository. Issue status is derived from the latest completed run.

## 6. Archetypes and aggregates

Manual archetype check (scanner not run):

- **Scoring rules**: strong fit for prioritization. Factors and weights as a versioned ruleset; each run records the version it used (G5).
- **Entitlements and quotas**: light fit for per-user limits (G10).
- **Dependency graph**: light fit for direct vs transitive and the path to a vulnerable package.
- **Party and roles**: trivial (owner only).
- No fit: pricing, ordering, inventory, billing, accounting, scheduling, waitlist, configurator, assignment.

Aggregates:

- **ScanRun**: forward-only state machine `queued -> running -> completed | partial | failed`. Stages and scanner runs live inside it. Invariant G2 spans runs of one repository, so it is enforced by the database: a partial unique index on `scan_runs(repository_id) WHERE status IN ('queued','running')`. Insert conflict means "return the active run".
- **Issue**: per (repository, fingerprint), unique constraint. Updated only at run finalization; G2 guarantees one writer per repository.
- **Repository, User**: CRUD rows.
- Locking: optimistic, as status-conditional updates (`UPDATE ... WHERE id = ? AND status = 'running' AND attempt = ?`). No pessimistic locks needed.

## 7. Integration: the scan flow

Flow: API creates the run (one transaction), enqueues a parent job; the clone job resolves the SHA, runs `git archive`, uploads `scan-artifacts/{runId}.tar.gz` to RustFS; child jobs per scanner (BullMQ Flows) download and extract into their own tmpfs; the parent continues with enrich, prioritize, summarize, finalize, delete the object.

| Failure scenario | Mechanism |
|---|---|
| DB commit succeeds, enqueue to Redis fails (queue in another store than the data) | No outbox. A sweeper re-enqueues runs stuck in `queued` for over N minutes. Enqueue uses `jobId = runId`, so a repeated enqueue does not create a second job. Loss without it: a run stuck in `queued` forever. |
| Job delivered twice (worker stalled, lock expired, job retried) | Idempotent writes: stage transitions are status-conditional; findings insert with unique (run, fingerprint) and conflict ignore; artifact key is deterministic; finalize only from `running`. An `attempt` token on the run makes a stale worker's writes no-ops. |
| One scanner fails or times out | Run ends `partial`; other scanners' results stand; G3 rule for "fixed". |
| Worker dies mid-scan | Retry with backoff; artifact still in RustFS until expiry, so a retried child does not re-clone. |
| LLM fails or returns invalid JSON | Schema validation rejects it; deterministic template summary; run still `completed`. |
| Artifact never deleted (crash before finalize) | Bucket expiry rule as a safety net, plus delete at finalize. |
| Progress message lost (Redis pub/sub is fire-and-forget) | Acceptable: the client reloads state from `GET /scans/:id`; SSE only speeds it up. |

Artifact safety: extracting a tarball of foreign code is an attack surface. Reject entries with `..` or absolute paths, and do not follow or extract symlinks, so a planted link cannot point a scanner at `/etc` or the worker's environment.

## 8. RustFS (local S3)

- Fits: S3-compatible, Apache-2.0, runs in compose; 1.0.0 reported as GA on 2026-09-16.
- Pin the image to `rustfs/rustfs:1.0.0` (or a digest), never `latest`. Set unique access and secret keys, as the docs require.
- Keep it on the internal compose network only; expose the console port only for local debugging.
- To verify before building (not confirmed from docs yet): bucket lifecycle expiration support, and server-side encryption. If expiry is missing, the sweeper also deletes orphaned objects.
- Cost: about one extra hour (Flows, upload/download, cleanup) on a ~3 h assignment. Without fan-out the artifact store is not needed at all; the README must say why it is there (scanners scale and retry independently, one consistent snapshot per run).

## 9. Verdict

The model is **sound in shape** (API + workers + queue, deterministic ranking, LLM only for narrative, pluggable scanners) and **needs nine changes before building**: Issue vs Finding (5), one active run per repository (G2), the "fixed only if verified" rule (G3), the fingerprint definition (G4), snapshot of enrichment and ruleset version (G5), masked secrets (G6), idempotent worker writes with an attempt token (7), a sweeper instead of an outbox (7), and safe artifact extraction (7).

## Open questions (default stands until answered)

1. Fingerprint fields in G4: default as written.
2. RustFS fan-out in the first milestone, or after measuring clone vs scan time: default fan-out, since Kamil asked for it.
3. Sweeper threshold N: default 5 minutes.
4. Max repo size and active scans per user: default 200 MB and 2.
