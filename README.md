# Judy App

A solo-traveler trip planner — "be gay while away." Plan trips, build itineraries, auto-allocate budgets, capture memories, find LGBTQ+-friendly experiences, and talk with **Judy Pierre**, a purple-rhino travel companion rendered either as a local 3D avatar or a HeyGen-streamed video avatar.

## Stack

Next.js 16 (App Router) · React 19 · Prisma 7 + SQLite/libSQL adapter · Auth.js (NextAuth v5, credentials) · Google Gemini · Google Maps Platform (Places + Weather) · ElevenLabs (TTS + Scribe transcription) · HeyGen + LiveKit (streamed avatar) · Stripe (travel package checkout) · Three.js / react-three-fiber · motion

## Getting started

```bash
git clone https://github.com/robs46859-eng/judy.git
cd judy
npm install
cp .env.example .env       # fill in values — see comments in the file
npx prisma migrate deploy  # applies migrations to the DB in DATABASE_URL
npm run dev
```

Open http://localhost:3000, create an account on the login screen, and build your first trip.

The app runs with only `DATABASE_URL` and `AUTH_SECRET` set. AI, voice, maps, and payment features degrade gracefully when their keys are absent — routes return `501` or fall back to mocks rather than crashing.

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma/libSQL connection. Production refuses to start without it. |
| `DATABASE_AUTH_TOKEN` | Hosted DB only | Auth token for Turso/hosted libSQL. |
| `AUTH_SECRET` | Yes | Auth.js session encryption. `openssl rand -base64 32` |
| `NEXT_PUBLIC_APP_URL` | Recommended | Public base URL. Used for the sitemap and Stripe post-checkout redirects; defaults to `http://localhost:3000`. |
| `GEMINI_API_KEY` | For AI features | Suggestions, Judy chat, memory captions/edits, SEO generation. |
| `GEMINI_TEXT_MODEL` / `GEMINI_IMAGE_MODEL` | Optional | Model overrides; see `src/lib/gemini/config.ts` for defaults. |
| `GOOGLE_MAPS_API_KEY` | For places/weather | Places API (New), Geocoding, Weather. |
| `STRIPE_SECRET_KEY` | For package sales | Creates products, prices, and payment links when Judy sells a custom travel package. Without it the tool returns a mock link and logs a warning. |
| `TTS_PROVIDER` | Optional | Set to `elevenlabs` for stage-2 lip sync. Unset stays on browser `speechSynthesis` with approximate jaw motion. |
| `ELEVENLABS_API_KEY` | For voice | Server-side TTS and Scribe realtime transcription tokens. |
| `ELEVENLABS_VOICE_ID` / `ELEVENLABS_MODEL_ID` | Optional | Default provider voice and model (`eleven_flash_v2_5` when unset). |
| `HEYGEN_API_KEY` | Optional | Live streamed avatar; falls back to the local 3D avatar. |
| `HEYGEN_AVATAR_ID` / `HEYGEN_VOICE_ID` | Optional | Streamed-avatar identity defaults. |
| `AVATAR_ADMIN_EMAILS` | Avatar Manager | Comma-separated email allowlist; falls back to `ADMIN_EMAIL` when unset. |
| `AVATAR_STORAGE_DIR` | Avatar Manager in production | Persistent directory outside the Git checkout for uploaded GLB versions. |
| `RHUBARB_BIN` | Optional | Path to the Rhubarb binary for offline viseme generation. |
| `RAG_FEEDS_URLS` | For `rag:feeds` | Comma-separated feed URLs to ingest into the knowledge base. |
| `RAG_FEEDS_ALLOWLIST` | For `rag:feeds` | Comma-separated hostname allowlist; feeds outside it are refused. |
| `HERMES_EDGE_BRIDGE_ENABLED` | Optional | Set to `true` to enable Hermes; defaults to `false`. |
| `HERMES_EDGE_BRIDGE_URL` | When Hermes is enabled | HTTPS producer-relay base URL. |
| `HERMES_EDGE_PRODUCER_SECRET` | When Hermes is enabled | Bearer credential used only by the server. |
| `HERMES_EDGE_BRIDGE_TIMEOUT_MS` | Optional | Relay timeout from 100–10000 ms; defaults to 5000 ms. |
| `SMTP_HOST/PORT/USER/PASS`, `ADMIN_EMAIL` | Optional | Contact-form email notification (submissions are always saved to the DB). |

### Per-voice provider overrides

`src/lib/voice/catalog.ts` defines application-level voice IDs (for example `travel-daddy-classic-es`, `judy-bright-en-gb`). Each may be given a dedicated provider voice via an environment variable named after it — `ELEVENLABS_VOICE_TRAVEL_DADDY_CLASSIC_ES`, `HEYGEN_VOICE_TRAVEL_DADDY_CLASSIC_ES`, and so on. When unset, the adapter falls back to the default provider voice.

> **Note on `travel-daddy-*` IDs.** The companion was renamed from "Travel Daddy" to Judy Pierre, but these voice IDs are persisted in user preferences and must not be renamed without a data migration. The old name survives only as an identifier, never as user-facing copy.

## Feature surface

| Area | Routes | Notes |
|---|---|---|
| Trips & itinerary | `/api/trips`, `/api/itinerary` | Session-scoped; itinerary mutations verify trip ownership. |
| Budget | `/api/budget/auto-allocate` | Distributes a trip budget across categories. |
| Memories | `/api/memories`, `/api/memories/[id]`, `/api/memories/caption`, `/api/memories/edit` | Gemini-generated captions, image edits, auto-translation, persistence. |
| Experiences | `/api/experiences` | LGBTQ+-friendly experience suggestions. |
| Alerts | `/api/alerts` | Travel-safety alerts for a destination. |
| Places & weather | `/api/places/autocomplete`, `/api/places/details`, `/api/weather` | Google Maps Platform. |
| Suggestions | `/api/suggestions` | Gemini destination suggestions. |
| Avatar | `/api/avatar/chat`, `speak`, `lipsync`, `session`, `stop`, `model`, `transcription-token` | Judy conversation, TTS, viseme timelines, HeyGen/LiveKit session lifecycle, ElevenLabs Scribe tokens. |
| Avatar admin | `/api/admin/avatar`, page at `/admin/avatar` | GLB upload and rig activation. |
| SEO | `/api/seo/generate`, pages at `/destinations` and `/destinations/[slug]` | Generated destination pages, plus `sitemap.ts` and `robots`. |
| Auth | `/api/auth/[...nextauth]`, `/api/auth/register` | Credentials provider. |
| Contact | `/api/contact` | Saved to DB; email notification optional. |
| Hermes | `/api/hermes/translate`, `/api/hermes/knowledge`, `/api/hermes/jobs/[id]` | Off by default — see below. |

Additional pages: `/` (dashboard), `/login`, `/affiliates`.

### Travel package checkout

`/api/avatar/chat` exposes a Stripe tool to the model: when a conversation converges on a concrete trip, Judy can create a Stripe product, price, and payment link for a custom package, persisted as `TravelPackage`. Post-checkout Stripe redirects to `${NEXT_PUBLIC_APP_URL}/itinerary?success=true`. With `STRIPE_SECRET_KEY` unset the helper returns a mock link so local development never hits Stripe.

## Hermes API

Hermes is disabled until `HERMES_EDGE_BRIDGE_ENABLED=true`. Its authenticated Node.js routes are:

| Route | Body |
|---|---|
| `POST /api/hermes/translate` | `{ "input": "...", "source_language": "en" (optional), "target_language": "es" }` |
| `POST /api/hermes/knowledge` | `{ "prompt": "...", "context_chunks": ["grounding text"] }` |
| `GET /api/hermes/jobs/{local-job-id}` | No body. Returns status and any final result/error. |

Translation input is limited to 6,000 characters and 6,000 UTF-8 bytes; knowledge prompts are limited to 4,000 characters, with prompt plus chunks capped at 8,000 UTF-8 bytes for the on-device model window. Language values are limited to 64 characters. Knowledge requests require 1–64 nonblank grounding chunks. Judy maps them to the fixed `judy-travel` collection. Unknown body fields are rejected. Request text and grounding chunks are sent to the relay but never stored in Judy's database.

The API returns only Judy's local job UUID. Relay job IDs and the producer credential remain server-side. Create limits are 5/user/minute and 30/IP/minute, status limits are 60/user/minute and 60/IP/minute, and database-backed UTC daily limits are 20 translation jobs and 10 knowledge jobs per user.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + `next build` (no DB required at build time) |
| `npm start` | Production server (`server.js`, Passenger-compatible) |
| `npm run db:migrate` | `prisma migrate deploy` — for `file:` (local SQLite) databases only |
| `./scripts/apply-migrations-turso.sh <db>` | Applies migration SQL to a Turso database via the Turso CLI (Prisma Migrate cannot connect to remote `libsql://` URLs) |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run rag:ingest` | Ingests the curated knowledge base into the RAG store (`src/lib/rag/ingest.ts`) |
| `npm run rag:feeds` | Pulls and ingests external feeds listed in `RAG_FEEDS_URLS`, filtered by `RAG_FEEDS_ALLOWLIST` |
| `npm run seo:generate` | Generates destination page content (`scripts/seo-generate.ts`) |

See `docs/RAG_SOURCES.md` for the curated source list.

## Architecture notes

- **Auth**: Auth.js credentials provider with JWT sessions. All trip/itinerary API routes are scoped to the session user; itinerary mutations verify trip ownership.
- **Validation**: every POST body is validated with zod (`src/lib/schemas.ts`).
- **Rate limiting**: in-memory per-user/per-IP limiter (`src/lib/rate-limit.ts`) on all Gemini/Google/HeyGen/ElevenLabs-backed routes. Single-process only — switch to a shared store if the app is ever scaled horizontally.
- **Security headers**: `next.config.ts` sets `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy, a `Permissions-Policy` allowing only `microphone=(self)`, and a CSP. The CSP permits `'unsafe-inline'`/`'unsafe-eval'` for scripts (a Next.js requirement) and `wss:` in `connect-src` for the HeyGen/LiveKit stream.
- **Avatar pipeline**: `/api/avatar/chat` produces the reply, `/speak` synthesizes audio, `/lipsync` produces a viseme timeline (Rhubarb when `RHUBARB_BIN` is set, otherwise an approximate mapping), and `/session` + `/stop` manage the streamed-avatar lifecycle. Conversation context is bounded — see `src/lib/avatar/conversationHistory.ts`.
- **Voice**: the client may only select from `APPROVED_VOICES` in `src/lib/voice/catalog.ts`; `PATCH /api/user/preferences` validates against that allowlist with zod. Arbitrary provider voice IDs are never accepted from the client.
- **Hermes**: the producer relay client is server-only, HTTPS-only, redirect-free, timeout-bounded, and disabled by default. Minute quotas are in memory; UTC daily caps and private relay/local ID mappings are persisted in `HermesJob`.
- **Database**: migrations live in `prisma/migrations`. Schema changes go through `prisma migrate` — the build never touches the database. Models: `User`, `Trip`, `ItineraryItem`, `BudgetItem`, `Memory`, `Document`, `EntertainmentPreference`, `TravelPackage`, `ContactMessage`, `HermesJob`, `HermesMinuteQuota`.
- **Avatar Manager**: `/admin/avatar` is available only to an authenticated email in `AVATAR_ADMIN_EMAILS` (or the existing `ADMIN_EMAIL` fallback). It accepts GLB files up to 25 MiB, validates facial morphs and jaw skin weights, and atomically activates only a compatible lip-sync rig. Uploads are SHA-256-versioned; older versions are retained and no delete endpoint is exposed.
- **Fonts**: Outfit is loaded via CSS `@import` at runtime with a system-font fallback; the build has no outbound-network dependency.

## Deployment (Hostinger / Passenger)

The deployment target is Hostinger with Phusion Passenger; `server.js` is the entry point (`npm start`).

1. Set the env vars from `.env.example` in the hosting panel (at minimum `DATABASE_URL`, `AUTH_SECRET`).
2. Point `DATABASE_URL` at persistent storage — a hosted libSQL database (e.g. Turso) is recommended over a local file on shared hosting.
3. Set `NEXT_PUBLIC_APP_URL` to the public origin so the sitemap and Stripe redirects resolve correctly.
4. For the Avatar Manager, set `AVATAR_ADMIN_EMAILS` to the administrator's Judy login email and set `AVATAR_STORAGE_DIR=/home/u876474286/judy-avatar-assets`. Create that persistent directory once with `mkdir -p /home/u876474286/judy-avatar-assets`; do not place it inside the deployment checkout.
5. Make sure the panel's build command is exactly `npm run build` — the build needs **no database connection**. If a build log ever shows `prisma db push`, the host is using a stale build command from before the 2026-07 repairs.
6. Apply migrations once per release that includes schema changes:
   - Turso: `./scripts/apply-migrations-turso.sh <db-name>` (Prisma Migrate can't connect to remote `libsql://` URLs — the script applies the SQL via the Turso CLI).
   - Local/file DB: `npm run db:migrate`.
7. Start/restart the app (Passenger runs `server.js`).

CI (GitHub Actions, Node 22) runs lint, tests, and a production build on every push/PR to `main`.

See `docs/DEPLOYMENT_REVIEW_2026-07-18.md` for the most recent deployment audit.

## Further documentation

| Doc | Contents |
|---|---|
| `AGENTS.md` | Required reading for AI agents — this Next.js version diverges from common training data. |
| `docs/AGENT_PROMPTS.md` | Prompt templates for dataset, voice, and SEO generation work. |
| `docs/RAG_SOURCES.md` | Curated knowledge-base sources. |
| `docs/GEMMA_INTEGRATION.md`, `docs/GEMMA_ROLLOUT_AND_COLAB.md` | On-device model integration and rollout plan. |
| `docs/DEPLOYMENT_REVIEW_2026-07-18.md` | Deployment audit. |
| `CODE_REVIEW.md`, `REPAIR_SPEC.md` | **Historical** — the July 2026 audit and repair plan, since completed. |

## Repository history note

This repo previously contained a second, abandoned Vite + Express + Capacitor app ("Hello Judy"). It was removed in the 2026-07 repair pass — see `CODE_REVIEW.md` and `REPAIR_SPEC.md` for the full audit and repair plan. A committed `dev.db` also existed in history; if the repo stays public, purge it with `git filter-repo` before real user data lands.
