# Judy App

A solo-traveler trip planner — "be gay while away." Plan trips, build itineraries, auto-allocate budgets, get AI-powered destination suggestions, and chat with **Travel Daddy**, a 3D (or optionally HeyGen-streamed) travel companion.

## Stack

Next.js 16 (App Router) · React 19 · Prisma 7 + SQLite (libSQL adapter) · Auth.js (NextAuth v5, credentials) · Google Gemini · Google Maps Platform (Places + Weather) · Three.js / react-three-fiber

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

## Environment variables

See `.env.example` for the full annotated list. Summary:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | Prisma/libSQL connection. Production refuses to start without it. |
| `DATABASE_AUTH_TOKEN` | Hosted DB only | Auth token for Turso/hosted libSQL. |
| `AUTH_SECRET` | Yes | Auth.js session encryption. `openssl rand -base64 32` |
| `GEMINI_API_KEY` | For AI features | Suggestions + Travel Daddy chat. |
| `GOOGLE_MAPS_API_KEY` | For places/weather | Places API (New), Geocoding, Weather. |
| `HEYGEN_API_KEY` | Optional | Live streamed avatar; falls back to the 3D placeholder. |
| `HERMES_EDGE_BRIDGE_ENABLED` | Optional | Set to `true` to enable Hermes; defaults to `false`. |
| `HERMES_EDGE_BRIDGE_URL` | When Hermes is enabled | HTTPS producer-relay base URL. |
| `HERMES_EDGE_PRODUCER_SECRET` | When Hermes is enabled | Bearer credential used only by the server. |
| `HERMES_EDGE_BRIDGE_TIMEOUT_MS` | Optional | Relay timeout from 100-10000 ms; defaults to 5000 ms. |
| `SMTP_HOST/PORT/USER/PASS`, `ADMIN_EMAIL` | Optional | Contact-form email notification (submissions are always saved to the DB). |

## Hermes API

Hermes is disabled until `HERMES_EDGE_BRIDGE_ENABLED=true`. Its authenticated Node.js routes are:

| Route | Body |
|---|---|
| `POST /api/hermes/translate` | `{ "input": "...", "source_language": "en" (optional), "target_language": "es" }` |
| `POST /api/hermes/knowledge` | `{ "prompt": "...", "context_chunks": ["grounding text"] }` |
| `GET /api/hermes/jobs/{local-job-id}` | No body. Returns status and any final result/error. |

Translation input is limited to 6,000 characters and 6,000 UTF-8 bytes; knowledge prompts are limited to 4,000 characters, with prompt plus chunks capped at 8,000 UTF-8 bytes for the on-device model window. Language values are limited to 64 characters. Knowledge requests require 1-64 nonblank grounding chunks. Judy maps them to the fixed `judy-travel` collection. Unknown body fields are rejected. Request text and grounding chunks are sent to the relay but never stored in Judy's database.

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
| `npm test` | Vitest unit tests (validation, quotas, Hermes client/service/routes) |

## Architecture notes

- **Auth**: Auth.js credentials provider with JWT sessions. All trip/itinerary API routes are scoped to the session user; itinerary mutations verify trip ownership.
- **Validation**: every POST body is validated with zod (`src/lib/schemas.ts`).
- **Rate limiting**: in-memory per-user/per-IP limiter (`src/lib/rate-limit.ts`) on all Gemini/Google/HeyGen-backed routes. Single-process only — switch to a shared store if the app is ever scaled horizontally.
- **Hermes**: the producer relay client is server-only, HTTPS-only, redirect-free, timeout-bounded, and disabled by default. Minute quotas are in memory; UTC daily caps and private relay/local ID mappings are persisted in `HermesJob`.
- **Database**: migrations live in `prisma/migrations`. Schema changes go through `prisma migrate` — the build never touches the database.
- **Fonts**: Outfit is loaded via CSS `@import` at runtime with a system-font fallback; the build has no outbound-network dependency.

## Deployment (Hostinger / Passenger)

The deployment target is Hostinger with Phusion Passenger; `server.js` is the entry point (`npm start`).

1. Set the env vars from `.env.example` in the hosting panel (at minimum `DATABASE_URL`, `AUTH_SECRET`).
2. Point `DATABASE_URL` at persistent storage — a hosted libSQL database (e.g. Turso) is recommended over a local file on shared hosting.
3. Make sure the panel's build command is exactly `npm run build` — the build needs **no database connection**. If a build log ever shows `prisma db push`, the host is using a stale build command from before the 2026-07 repairs.
4. Apply migrations once per release that includes schema changes:
   - Turso: `./scripts/apply-migrations-turso.sh <db-name>` (Prisma Migrate can't connect to remote `libsql://` URLs — the script applies the SQL via the Turso CLI).
   - Local/file DB: `npm run db:migrate`.
5. Start/restart the app (Passenger runs `server.js`).

CI (GitHub Actions) runs lint, tests, and a production build on every push/PR to `main`.

## Repository history note

This repo previously contained a second, abandoned Vite + Express + Capacitor app ("Hello Judy"). It was removed in the 2026-07 repair pass — see `CODE_REVIEW.md` and `REPAIR_SPEC.md` for the full audit and repair plan. A committed `dev.db` also existed in history; if the repo stays public, purge it with `git filter-repo` before real user data lands.
