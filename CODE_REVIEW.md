# Judy App — Codebase Review

> **⚠️ HISTORICAL DOCUMENT — do not treat as current state.**
> This audit describes the repo as of 2026-07-01. The repairs it recommends were
> completed in commit `c07202a` and the dead predecessor app has been removed.
> Since then the app has gained ElevenLabs voice, Stripe package checkout,
> Memories, Experiences, alerts, SEO destination pages, and a Judy Pierre
> purple-rhino rebrand (the "Travel Daddy" name below is obsolete).
> **For current state, read `README.md`.** Kept for provenance only.

**Reviewed:** `robs46859-eng/judy` @ `eac7bbf` ("Add custom server.js for Hostinger Passenger compatibility")
**Date:** 2026-07-01
**Method:** Full clone, dependency install, live `next build` attempt, static read-through of every server route and component, git history review, and SQLite inspection. Findings below are marked **Verified** (reproduced directly) or **Inferred** (established by reading code, not executed).

## What this app actually is

The repo contains two unrelated applications layered on top of each other:

1. **The live app**: a Next.js 16 (App Router) project — `src/app/*`, `src/components/*`, `src/lib/prisma.ts`, Prisma + SQLite via `@libsql/client`/`@prisma/adapter-libsql`. This is what `npm run dev`, `npm run build`, and `npm start` actually execute. It's a solo-traveler trip planner ("Judy") with an itinerary builder, budget auto-allocation, a 3D "Travel Daddy" chat mascot backed by Gemini, weather, and Google Places autocomplete.
2. **A dead predecessor app**: `server.ts`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `capacitor.config.json`, `android/`, `ios/`, `dist/`. This was a prior Vite + Express + Capacitor project ("Hello Judy") with a much larger feature set (social feed, marketplace, safety map, photo albums, admin dashboard). Git history shows it was superseded by a `create-next-app` reset at commit `3f9fc93`, but the old files were never deleted. None of it runs: `server.ts` imports `express`, `vite`, `nodemailer`, and `@google/genai`, none of which exist in `package.json` or the lockfile. `tsconfig.json` explicitly excludes these files, and no npm script touches them.

This split is the root cause of most of the confusion in the repo's own docs: `BUILDOUT.md` and `handoff.md` describe features (social feed, marketplace, photo albums, admin dashboard, contact-form email) as "fully live," but they describe the **dead** Express app, not the Next.js app that's actually deployed. Anyone using those docs to judge production-readiness will be misled.

---

## P0 — Fatal / blocks production

### 1. No user data isolation — every visitor shares one account (Verified by code read)
No component ever references `userId`. `GET /api/trips` (`src/app/api/trips/route.ts`) with no query param runs `prisma.trip.findMany({ where: undefined })`, returning **every trip from every user**, and `Dashboard.tsx` just takes `trips[0]` — the single most-recently-created trip in the whole database. `POST /api/trips` auto-assigns any request without a `userId` to `prisma.user.findFirst()`, creating a "Judy User" account on first use and reusing it forever after. Net effect: there is exactly one shared trip visible to all visitors, and anyone can create/delete itinerary items belonging to it. There is no login system at all — this isn't a bug in an auth layer, there is no auth layer.

### 2. Database connection ignores `DATABASE_URL` (Verified by code read)
`src/lib/prisma.ts` hardcodes the database location:
```ts
const adapter = new PrismaLibSql({ url: 'file:prisma/dev.db' });
```
`process.env.DATABASE_URL` is never read here (only `prisma.config.ts`, used by the Prisma CLI for migrations, reads it). Consequences: you cannot point the running app at a real hosted database no matter what you set in production config; on any host with an ephemeral filesystem (containers, most PaaS, serverless) all data is wiped on every restart/redeploy; and any horizontally-scaled deployment (>1 instance) gives each instance its own diverging SQLite file.

### 3. Production build runs schema push against the live DB (Verified — package.json)
```json
"build": "prisma generate && prisma db push && next build"
```
`prisma db push` runs on every build/deploy. It diffs and applies schema changes directly with no migration history and no review step, and it requires a live, reachable database at build time — a transient DB blip fails the entire deployment. `prisma/migrations/` already exists in the repo, meaning proper migrations are set up but bypassed in favor of the riskier `db push` at build time.

### 4. Two front-end features call API routes that don't exist (Verified — grep + route listing)
`PhotoAlbumEditor.tsx` calls `POST /api/photo-albums/digital` and `POST /api/photo-albums/physical-orders`; `ItineraryViewer.tsx` calls `GET /api/recommendations`. None of these routes exist under `src/app/api/` — they only ever existed in the dead `server.ts`. Both features 404 in the deployed app: photo album creation/ordering and destination recommendations are entirely non-functional despite having full front-end implementations.

### 5. Contact form is a no-op that reports success (Verified — code read)
`src/app/api/contact/route.ts` only `console.log`s the submission and returns `{ success: true }`. Nothing is persisted and no email is sent, despite the UI (and `BUILDOUT.md`) implying it works. Submissions are silently lost.

### 6. Unauthenticated endpoints spend your API budget (Verified — code read)
`/api/avatar/chat`, `/api/suggestions` (Gemini), `/api/places/autocomplete`, `/api/places/details` (Google Places), and `/api/weather` (Google Weather) require no authentication, session, or rate limit. Anyone — including bots — can call them directly and run up billed usage on Gemini and Google Maps Platform with no cap.

### 7. Build breaks without a precise, undocumented step order (Verified by running `next build`)
Running `next build` without first running `prisma generate` fails immediately:
```
Module not found: Can't resolve '@/generated/prisma/client'
```
This is handled today only because `npm run build` happens to chain `prisma generate` first — but it's a fragile, implicit dependency that any deployment tooling change (different build command, partial script execution, Hostinger's build handling) can silently break.

### 8. Build requires outbound internet access at build time for fonts (Verified by running `next build`)
`layout.tsx` uses `next/font/google` (Outfit), which fetches `fonts.googleapis.com` during the build step, not at runtime. On any build environment with restricted or no outbound internet (common on locked-down CI or some shared hosts), the production build fails outright with no app-level fallback.

### 9. A real SQLite database file is committed to git (Verified)
`dev.db` (65KB, valid SQLite file with the full production schema applied) is checked into the repository root and was part of the clone. `.gitignore` only excludes `prisma/dev.db` and `prisma/dev.db-journal` — it misses the root-level `dev.db` that Prisma actually creates when `DATABASE_URL` falls back to `file:./dev.db` (per `prisma.config.ts`). Its `User` table currently has 0 rows, so no live PII is exposed today, but going forward every local dev session risks committing a live database snapshot — now to a **public** repository (this repo was private until this review; it was made public to allow this clone). Recommend purging it from history before leaving the repo public.

### 10. Documented mobile deployment path doesn't exist (Verified — package.json has no matching scripts)
`MOBILE_DEPLOYMENT.md` instructs users to run `npm run mobile:build`, `npm run cap:open-android`, `npm run cap:open-ios`. None of these scripts exist in `package.json`, and Capacitor packages were explicitly removed from dependencies per git history ("Remove Capacitor packages — not used by web app"). The entire documented mobile release process is non-functional; `android/`, `ios/`, `capacitor.config.json`, and `dist/` are leftover scaffolding from the pre-Next.js app.

---

## P1 — Should fix before real users rely on this

- **`.env.example` is incomplete.** The live app reads `ADMIN_KEY`, `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_PORT`, `ADMIN_EMAIL` in the dead `server.ts` (not needed for the live app) but `.env.example` doesn't distinguish what's actually required by the Next.js app versus leftover from the old one — anyone provisioning from this file alone will be confused about what's live.
- **No input validation.** `/api/trips` and `/api/itinerary` accept arbitrary request bodies with no schema validation (no zod/yup/etc.). `new Date(departureDate)` on a missing/malformed date produces `Invalid Date`, which Prisma rejects with a raw 500 and no actionable message.
- **No tests anywhere in the repo** (confirmed: no `*.test.*`/`*.spec.*` files) and **no CI configuration** (confirmed: no `.yml`/`.yaml` workflow files). Nothing prevents a regression from reaching production.
- **No rate limiting, no CORS policy, no security headers.** `next.config.ts` is the untouched default (`{}`).
- **No observability.** All error handling is `console.error`; nothing is shipped to a log aggregator or error tracker, so production failures are invisible unless someone is tailing server logs.
- **Two competing deployment stories.** A `Dockerfile` (expects a container host with `DATABASE_URL` reachable at build time) and a custom `server.js` "for Hostinger Passenger compatibility" (shared hosting) exist side by side with no documentation saying which is authoritative. Given Finding #2, neither will actually persist data correctly as configured.
- **`README.md` is the unedited `create-next-app` boilerplate** — it describes generic Next.js getting-started steps, not this app, its environment variables, or its architecture.
- **Admin dashboard (`/admin/orders`) only exists in the dead `server.ts`.** If anyone revives it, note it uses non-constant-time string comparison for the admin key check — fine to defer, but flag if that code path is ever resurrected.

## P2 — Cleanup / nice-to-have

- Delete `server.ts`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `capacitor.config.json`, `android/`, `ios/`, `dist/`, `MOBILE_DEPLOYMENT.md`, `handoff.md`, `BUILDOUT.md` (or clearly relabel as historical/archived) — this is the single highest-leverage cleanup, since it's actively misleading both humans and coding agents (note that `AGENTS.md` already had to be added just to stop agents from treating this as an ordinary Next.js app).
- Remove unused default Next.js placeholder assets in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`) if not referenced.
- `NEXT_PUBLIC_APP_URL` is documented in `.env.example` but never read anywhere in the code — either wire it up or remove it.
- HeyGen integration (`/api/avatar/session`, `HEYGEN_API_KEY`) is fully implemented server-side but never called by any component (`TravelDaddy.tsx` only renders a local Three.js placeholder model) — either finish wiring it in or remove the dead route and drop the key requirement.

---

## Verification notes

- `npm install` succeeds cleanly (506 packages, no errors) against the current `package.json`/lockfile.
- `prisma generate` could not be completed in this sandboxed review environment because the network policy here blocks `binaries.prisma.sh` — this is a sandbox limitation, not a repo bug. Everything else (the build failure without a generated client, the missing `DATABASE_URL` usage, the missing dependencies for `server.ts`) was confirmed directly by reading code, running `next build`, and grepping `package-lock.json`.
- The SQLite file was inspected read-only with Python's `sqlite3` module; `SELECT count(*) FROM User` returned 0.
- Git history (`git log --all -p`) was scanned for leaked API keys/secrets — none were found; only placeholder strings like `MY_GEMINI_API_KEY` appear.
