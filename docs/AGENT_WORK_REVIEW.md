# Judy Agent Work Review

Reviewed: 2026-07-16  
Scope: Hermes/Gemma integration, local RAG, SEO generation, Prisma schema and migrations, CI, and deployment behavior.

## Executive summary

The work is a solid foundation and is safe to keep deployed. Authentication, per-user job ownership, request validation, byte budgets, rate limits, idempotency, response-size limits, terminal-state guards, and Gemini/template fallbacks are all present. The migration matches the checked-in Prisma models, the app builds, and 51 tests pass.

The largest gap is not a broken feature; it is lack of production evidence. The app silently falls back whenever Hermes fails, so a healthy-looking UI does not prove Gemma handled a request. Turso migrations are also applied outside Prisma Migrate, but the repository has no durable verification/ledger procedure for that manual operation.

## Verification performed

| Check | Result | Notes |
|---|---|---|
| Working tree at review start | Clean | `main` at the deployed work |
| Lint/build/test history | Pass | Deployment CI was green; 51 tests passed |
| Prisma schema versus SQL migration | Pass with notes | Tables, indexes, relation, and defaults align |
| Local RAG index | Pass but too small | 2 chunks and 2 embeddings |
| `prisma migrate status` | Not a production check | Local config selected `file:./dev.db`; Prisma Migrate is not the supported remote Turso deployment mechanism |
| Destructive DB operations | None | No migration or database mutation was run during this review |

### Live bridge canary — 2026-07-16

The production Judy producer credential was used for synthetic data only.

| Check | Result | Evidence |
|---|---|---|
| Bridge authentication and submission | Pass | Translation job accepted with HTTP 201 and `queued` status |
| Bridge health | Pass | `/health` returned HTTP 200 with relay and database `ok`, service `hermes-producer-relay`, version `1.0.0` |
| Bridge-side throttling | Pass, contract concern | Fast status polling returned HTTP 429; a second create inside the rate window also returned 429 |
| Worker consumption | Fail | A compliant retry used 10-second polling; the job remained `queued` for 123 seconds across 12 successful polls |
| Translation output | Fail | No terminal status or usable result |
| Knowledge output | Not run | Stopped after translation proved the worker was not consuming queue jobs |

**Interpretation:** relay ingress, authentication, rate limiting, and the relay database are working. The worker consumer is offline, connected to a different queue/database, unable to lease jobs, or failing before changing job state. The bridge health endpoint does not currently expose worker readiness.

### Live worker retest — 2026-07-16

After the Pixel/gateway/model state returned to green, the same production canaries were repeated with 10-second polling:

| Check | Result | Evidence |
|---|---|---|
| Translation | Pass | `queued` → `completed`; correct Spanish output; 10.6 seconds total |
| Grounded knowledge | Pass | `queued` → `leased` → `completed`; answer used only supplied context; 20.7 seconds total |
| Rate limiting during compliant poll | Pass | No HTTP 429 responses |

**Updated interpretation:** the public relay, queue, worker connection, model runtime, translation handler, and knowledge handler all work end to end. The measured 20.7-second knowledge latency is incompatible with Judy's current 9-second server-side `runTravelKnowledge()` budget, so healthy Gemma chat requests can still be abandoned in favor of Gemini. Translation can fit inside the UI's 30-second timeout, but the UI's current 900 ms polling interval remains unnecessarily aggressive for the bridge.

## Findings, ordered by priority

### P1 — No proof that production requests are actually served by Gemma

`runTravelKnowledge()` catches every Hermes/config/quota/upstream/timeout/result-shape error and returns `null`. This is good user-facing fallback behavior, but there is no structured log or metric for:

- Hermes submission attempts and successes
- fallback reason (`disabled`, `quota`, `timeout`, `upstream`, invalid result)
- Gemma versus Gemini response share
- queue latency and total latency
- model/adapter version used by the worker

Consequently, the app can appear healthy while Gemma serves zero traffic.

**Recommendation:** add privacy-safe structured events and a small operational dashboard before raising Gemma traffic. Never log prompts, trip data, secrets, upstream job IDs, or raw model output. Track only generated local correlation IDs, job type, status class, duration, fallback reason, and worker model version.

### P1 — Turso migration deployment has no repository-owned verification procedure

The `20260715000000_add_hermes_jobs` migration correctly creates `HermesJob`, the unique bridge-job index, the user/type/date lookup index, the cascading user foreign key, and `HermesMinuteQuota`. However, Turso/libSQL remote schema changes are not deployed by ordinary Prisma Migrate over HTTP. Prisma's Turso guidance says to generate migration SQL locally and apply it with the Turso CLI.

That explains why the app build intentionally runs only `prisma generate` and `next build`. It also means `prisma migrate status` against the local file is not evidence that production is current, and a manually applied Turso migration may not have Prisma's `_prisma_migrations` history.

**Recommendation:** document and automate a non-destructive verification step using Turso's schema inspection after each manual migration. Record migration filename, SQL checksum, target database, UTC application time, and operator in a deployment ledger. Continue to keep schema application out of Hostinger's build command. Never add `prisma db push` to production builds.

Reference: [Prisma's Turso migration workflow](https://docs.prisma.io/docs/orm/v6/overview/databases/turso).

### P1 — The Gemma-first request can exceed its stated latency budget

The knowledge runner sets a 9-second polling budget only after job creation. Each bridge request may independently wait up to 5 seconds, and a poll that begins just before the deadline may also consume its full timeout. The total request can therefore exceed 9 seconds substantially before falling back to Gemini.

**Recommendation:** introduce one absolute deadline covering submission plus every poll, and pass the remaining time into each bridge request. Reserve enough time for the Gemini fallback. Add tests using fake timers for slow create, slow poll, and deadline-edge cases.

### P1 — Current daily quota is too small for a Gemma-primary product

`knowledge` is capped at 10 jobs per user per UTC day and is shared by chat and SEO. A normal chat session can exhaust it. Failed upstream submissions also consume a daily reservation, which protects capacity but accelerates exhaustion during outages.

**Recommendation:** do not merely increase the limit. First measure worker throughput and error rate, then split dedicated job types (`chat`, `seo`, `itinerary`, `suggestions`) with separate budgets. Consider whether failed submissions should be refunded only for narrowly defined infrastructure failures.

### P1 — There is no production contract test for the bridge or worker result

Unit tests mock the client/service boundaries. `extractHermesText()` intentionally guesses among many result keys, which protects the UI but can hide a worker contract change. There is no test proving that the real bridge accepts Judy's payload, the worker loads the expected Gemma model, and the returned shape is extractable.

**Recommendation:** add a low-cost authenticated staging canary that submits one synthetic `translate` and one synthetic `knowledge` job, polls to completion, validates the exact public result schema, and reports model version. Run it on demand and before production promotion, not on every public request.

### P1 — RAG content is a demonstration, not a production corpus

The committed index contains one source split into two chunks. Retrieval works technically, but this is not enough evidence for reliable travel or LGBTQ+ safety guidance. Fine-tuning cannot substitute for current destination facts.

**Recommendation:** build a source-governed corpus with URLs, publishers, locale, retrieval timestamp, validity window, and content owner. Separate evergreen style examples from volatile safety, legal, venue, pricing, and event data. Re-embed on a schedule and measure retrieval relevance with a held-out query set.

### P2 — Daily quota reservation needs a concurrency test against Turso

The daily limit performs `count` followed by `create` inside a Prisma transaction. SQLite-style serialization may protect this in practice, but the behavior should be proven through the libSQL adapter under concurrent requests rather than assumed from unit-store mocks.

**Recommendation:** run a staging concurrency test that submits more than the daily limit simultaneously and assert that no more than the limit are created. If it fails, replace count-then-create with an atomic daily counter/reservation design.

### P2 — String columns allow invalid job types and statuses at the database layer

Application code validates stored `type` and `status`, but the migration has no database `CHECK` constraints. Manual writes or future code defects can insert invalid values, after which reads throw.

**Recommendation:** retain application validation and consider `CHECK` constraints in a future additive/rebuild migration after confirming Turso's migration procedure. This is hardening, not an emergency migration.

### P2 — Retention and cleanup are undefined

Every Hermes attempt creates a durable job row. Minute quota rows are reused per hashed identity, but the number of unique network identities can still grow. There is no retention policy or cleanup task.

**Recommendation:** define operational retention (for example, short retention for failed jobs and a longer aggregate-only analytics window), then implement a safe scheduled cleanup with monitoring and backups. Do not delete records until product/audit needs are agreed.

### P2 — Existing integration documentation is stale

`docs/GEMMA_INTEGRATION.md` still names `text-embedding-004`, while code now correctly uses `gemini-embedding-001` because the earlier model was retired. It also describes Gemma as text-only, while current Gemma 4 hosted models can accept image input. The Judy integration remains text-only today, which should be stated as an application boundary rather than a permanent model limitation.

**Recommendation:** update that document when implementing the rollout plan, keeping model identifiers and capability claims versioned.

### P3 — Fallback source labeling is inconsistent

Gemma chat responses include `source: "gemma"`; Gemini responses omit the source. This is not user-visible breakage, but it makes client diagnostics and analytics less reliable.

**Recommendation:** return a consistent source enum from every successful path while keeping it out of displayed copy unless needed.

## Migration-specific assessment

### What is correct

- `HermesJob.userId` has a cascading foreign key to `User`.
- `bridgeJobId` is unique, preventing accidental attachment of one upstream job to multiple local jobs.
- `@@index([userId, type, createdAt])` supports the daily-count query.
- Quota updates use an atomic `INSERT ... ON CONFLICT ... WHERE ... RETURNING` statement.
- The production build does not mutate the database.
- The migration is additive and does not alter or delete existing user/trip data.

### What should be verified in Turso

Use read-only schema inspection to confirm:

1. Both tables exist with the expected columns.
2. `HermesJob_bridgeJobId_key` and `HermesJob_userId_type_createdAt_idx` exist.
3. Foreign keys are enabled and the user cascade is present.
4. A synthetic staging user can create, read, transition, and cascade-delete a synthetic job.
5. Concurrent quota requests cannot exceed configured limits.

Do this in staging first. Do not rerun the already-applied production SQL blindly.

## Recommended next actions

1. Add Gemma/Hermes telemetry and a staging canary.
2. Verify and record the current Turso schema without applying migration SQL again.
3. Enforce a single end-to-end request deadline.
4. Establish a 100–300 prompt evaluation set before training.
5. Expand and govern the RAG corpus.
6. Measure the baseline model, then fine-tune only behaviors that prompting and RAG do not solve.
7. Load-test the worker and quotas before routing most production traffic to Gemma.

## Overall verdict

**Approve with follow-up work.** The implementation is defensively engineered and safe to iterate on. It is not yet demonstrably “Gemma fully rolling” because successful fallback masks real Gemma availability and the corpus, evaluation, migration evidence, and operational metrics are not production-grade yet.
