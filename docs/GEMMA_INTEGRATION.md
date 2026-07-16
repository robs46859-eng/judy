# Gemma × Hermes Integration Map

_How the Judy travel app talks to the Gemma intelligence layer on the
gemma-hermes VPS worker — what's built, what's next, and what compute/resources
to add at each step._

Last updated: 2026-07-15

---

## 1. Architecture at a glance

```
Judy (Next.js)                Edge bridge (HTTPS)            VPS worker
─────────────────             ───────────────────           ─────────────
producer client   ──POST /v1/jobs──▶  relay + auth   ──▶   Gemma queue
(HermesClient)    ◀─GET /v1/jobs/:id─  job status     ◀──   worker pool
                                                            (translate,
 local job store  (Prisma: HermesJob, HermesMinuteQuota)     knowledge, …)
```

The contract is an **async job queue**, not a request/response model:

1. The app `POST`s a job → gets `202 { job_id, status }`.
2. The app polls `GET /api/hermes/jobs/:id` until `succeeded` / `failed`.
3. Every job is recorded in `HermesJob` (owned by a user) and rate-limited by
   `HermesMinuteQuota`.

This decoupling is deliberate: the worker can scale/queue independently, and the
app never blocks on model latency.

---

## 2. What's built today

**Backend (already deployed by you):** `translate` + `knowledge` job types,
producer client, service with per-user ownership + quotas, routes
(`/api/hermes/translate`, `/api/hermes/knowledge`, `/api/hermes/jobs/[id]`).

**Wired into the UI this pass:**

| Piece | File | Notes |
|---|---|---|
| Client hook | `src/lib/hermes/useHermesJob.ts` | submit + poll + timeout, reused everywhere |
| Result extractor | `src/lib/hermes/result.ts` | pulls text from any worker result shape |
| Translation panel | `src/components/TravelDaddy.tsx` | avatar-side translate UI |
| Gemma-first chat | `src/app/api/avatar/chat/route.ts` | knowledge → Gemini fallback |
| Grounding | `src/lib/hermes/grounding.ts` | trip → context chunks; dataset → ingestion JSONL |
| SEO generation | `src/lib/seo/generate.ts`, `/api/seo/generate` | Gemma → Gemini → template |

Everything degrades gracefully: if Hermes is disabled or out of quota, each
feature falls back (Gemini, or a deterministic template) and never errors.

---

## 3. "Gemma for most jobs" — the job-type roadmap

Today the worker exposes **two** job types. Everything the app sends must be one
of them. There are two ways to route "most jobs" through Gemma:

**Option A — reuse `knowledge` for everything (no worker change).**
Suggestions, itinerary ideas, budget insights, and SEO can all be phrased as
`knowledge` prompts. This is how SEO and chat work now. Downside: they share the
`knowledge` daily quota and a generic prompt path.

**Option B — add dedicated job types on the worker (recommended as you grow).**
Give each capability its own type so it can be tuned, quota'd, and monitored
separately. Suggested additions:

| Job type | Purpose | App-side work I add |
|---|---|---|
| `seo` | Structured SEO metadata | schema + route (promote from `knowledge`) |
| `suggestions` | Destination/activity ideas | schema + wire existing suggestions route |
| `caption` | Photo/video captions + alt text (Memories) | schema + route |
| `itinerary` | Draft day-by-day plans | schema + route |

For each new type you add on the VPS, I add: a payload schema in
`src/lib/hermes/schemas.ts`, a daily limit in `quotas.ts`, and a thin route.
The client/service/store layers already handle any type generically.

---

## 4. Quotas & compute — the scaling knobs

Current limits (in `src/lib/hermes/quotas.ts`) are intentionally conservative:

| Limit | Value | Where |
|---|---|---|
| translate / day / user | 20 | `HERMES_DAILY_LIMITS.translate` |
| knowledge / day / user | 10 | `HERMES_DAILY_LIMITS.knowledge` |
| create / minute / user | 5 | `HERMES_CREATE_USER_LIMIT` |
| create / minute / IP | 30 | `HERMES_CREATE_IP_LIMIT` |
| status / minute | 60 | `HERMES_STATUS_*_LIMIT` |

**"Most jobs" will exhaust 10 knowledge/day almost immediately.** To scale:

1. **App side (I do):** raise `HERMES_DAILY_LIMITS` and the minute limits to
   match real usage.
2. **Worker side (you do):** add compute so the higher throughput is actually
   served — more worker replicas / GPU or CPU inference slots, a bigger queue,
   and (if needed) horizontal scaling.
3. **Shared store (when horizontal):** the minute-quota store is already in
   Postgres/libSQL (`HermesMinuteQuota`), so it survives multiple app
   instances. The app's *other* limiter (`rate-limit.ts`) is in-memory — swap it
   for Redis/Upstash if you run more than one app process.

Rule of thumb: **raise a quota only alongside the compute to serve it.** Tell me
the new ceilings once the VPS capacity is in place and I'll set them.

---

## 5. Grounding on "current data"

`knowledge` is retrieval-augmented. Two complementary grounding paths:

**5a. Per-request context (built, works now).**
`tripToContextChunks(trip)` turns the user's trip + itinerary + budget into
compact chunks that ride along with the prompt (byte-budgeted under the 8 KB
knowledge cap). Use it wherever the answer should be about *this* user's trip.

**5b. Corpus ingestion (needs a worker endpoint).**
For durable knowledge — your travel datasets, destination feeds, gay-travel
guides — documents should live in the worker's `judy-travel` collection so Gemma
retrieves them for everyone. `datasetToIngestionDocuments()` + `toJsonl()`
produce the upload shape:

```json
{ "id": "lisbon-nightlife", "text": "…", "collection": "judy-travel",
  "metadata": { "source": "feed", "region": "PT" } }
```

**What I need from the worker to finish this:** the ingestion endpoint contract
(URL, auth, batch format — does it accept this JSONL, or a specific schema?).
Once you share it, I'll build the exporter job that pushes app data + feeds on a
schedule.

---

## 6. Text vs. media — an honest boundary

**Gemma is a text model.** It cannot process, edit, or generate image/video
pixels or frames. Keep this split clear so nothing is wired to silently fail:

| Task | Right tool |
|---|---|
| Captions, alt text, tags, "memory" descriptions | ✅ Gemma (`caption` job) |
| SEO copy, translations, Q&A, itinerary text | ✅ Gemma |
| Understanding image content (labels, objects) | Vision model (e.g. Gemini vision), **not** Gemma |
| Editing / filtering / trimming photos & video | Media pipeline (ffmpeg / image lib) or a generative media API |

For the **Memories** feature: route the *text* (captions/alt/tags) through Gemma;
handle the *pixels* (edits, filters, album video) with a dedicated media service.
When you're ready to build Memories, we'll pick that media service separately.

---

## 7. Phased rollout & resources to add

| Phase | App work (me) | Resources you add (VPS) |
|---|---|---|
| **0 — live now** | translate, Gemma-first chat, SEO, grounding helpers | Hermes enabled ✅ |
| **1 — corpus** | ingestion exporter for `judy-travel` | ingestion endpoint + vector store capacity |
| **2 — more text jobs** | `suggestions`, `itinerary` job types + routes | worker types + compute for the load |
| **3 — raise limits** | bump `HERMES_DAILY_LIMITS` / minute limits | inference throughput to match |
| **4 — Memories text** | `caption` job type + captions UI | worker `caption` type |
| **5 — Memories media** | media UI + pipeline glue | separate media/vision service |

---

## 8. Open questions for you

1. **Ingestion contract** — what endpoint/format does the worker expose for
   loading documents into `judy-travel`?
2. **Target quotas** — what daily/throughput ceilings should we aim for once
   compute is added?
3. **Media service** — for Memories editing, do you want to stand up ffmpeg on
   the VPS, or use a hosted media/vision API?
