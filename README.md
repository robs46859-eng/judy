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
| `SMTP_HOST/PORT/USER/PASS`, `ADMIN_EMAIL` | Optional | Contact-form email notification (submissions are always saved to the DB). |

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + `next build` (no DB required at build time) |
| `npm start` | Production server (`server.js`, Passenger-compatible) |
| `npm run db:migrate` | `prisma migrate deploy` — run as an explicit release step, never during build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (validation schemas, rate limiter) |

## Architecture notes

- **Auth**: Auth.js credentials provider with JWT sessions. All trip/itinerary API routes are scoped to the session user; itinerary mutations verify trip ownership.
- **Validation**: every POST body is validated with zod (`src/lib/schemas.ts`).
- **Rate limiting**: in-memory per-user/per-IP limiter (`src/lib/rate-limit.ts`) on all Gemini/Google/HeyGen-backed routes. Single-process only — switch to a shared store if the app is ever scaled horizontally.
- **Database**: migrations live in `prisma/migrations`. Schema changes go through `prisma migrate` — the build never touches the database.
- **Fonts**: Outfit is loaded via CSS `@import` at runtime with a system-font fallback; the build has no outbound-network dependency.

## Deployment (Hostinger / Passenger)

The deployment target is Hostinger with Phusion Passenger; `server.js` is the entry point (`npm start`).

1. Set the env vars from `.env.example` in the hosting panel (at minimum `DATABASE_URL`, `AUTH_SECRET`).
2. Point `DATABASE_URL` at persistent storage — a hosted libSQL database (e.g. Turso) is recommended over a local file on shared hosting.
3. Run `npm run build`.
4. Run `npm run db:migrate` once per release that includes schema changes.
5. Start/restart the app (Passenger runs `server.js`).

CI (GitHub Actions) runs lint, tests, and a production build on every push/PR to `main`.

## Repository history note

This repo previously contained a second, abandoned Vite + Express + Capacitor app ("Hello Judy"). It was removed in the 2026-07 repair pass — see `CODE_REVIEW.md` and `REPAIR_SPEC.md` for the full audit and repair plan. A committed `dev.db` also existed in history; if the repo stays public, purge it with `git filter-repo` before real user data lands.
