# Judy App — Phased Repair Spec

Companion to `CODE_REVIEW.md`. Each phase is ordered so later phases don't get rebuilt on top of a foundation that's about to change. Don't skip ahead to Phase 3 polish while Phase 1's data layer is still broken — it'll need redoing.

## Phase 0 — Decisions before writing any code

A few product calls block engineering work and should be made first:

- **Repo visibility.** The repo was made public for this review. Decide whether it stays public. If it does, purge `dev.db` from git history (`git filter-repo` or BFG) before real user data ever lands in it — a committed SQLite file is much harder to remove after the fact once it's cached by forks/mirrors.
- **Dead code disposition.** Confirm the Vite/Express/Capacitor app (`server.ts`, `src/App.tsx`, `vite.config.ts`, `android/`, `ios/`, `dist/`, `capacitor.config.json`) is fully abandoned. If any of its features (social feed, marketplace, safety map, photo albums, admin dashboard) are still wanted, they need to be reimplemented as Next.js API routes + React components — the existing Express code cannot be "turned back on" as-is since it depends on packages that were removed.
- **Deployment target.** Pick one of Docker or Hostinger/Passenger (`server.js`), not both, and delete the tooling for the other. This also determines whether you need a persistent volume (Docker) or Hostinger's filesystem persistence guarantees for the database.
- **Database provider.** Pick a real hosted SQLite-compatible provider (e.g. Turso) or a conventional Postgres/MySQL host. This determines the exact `DATABASE_URL` format needed in Phase 1.

## Phase 1 — Make the data layer real (blocks everything else)

1. Fix `src/lib/prisma.ts` to read `process.env.DATABASE_URL` instead of the hardcoded `file:prisma/dev.db`, with a local-dev fallback only when `NODE_ENV !== 'production'`.
2. Provision the real database chosen in Phase 0, run `prisma migrate deploy` against it once by hand to confirm connectivity and schema apply cleanly.
3. Change `"build": "prisma generate && prisma db push && next build"` to `"build": "prisma generate && next build"`. Move schema changes to an explicit, reviewed `prisma migrate deploy` run as its own release step (CI job or manual command), never bundled into the app build.
4. Confirm the build no longer requires DB connectivity at build time (only `prisma generate`, which needs the schema file, not a live DB).

**Acceptance:** setting `DATABASE_URL` to a real hosted database, running the build, and restarting the app process leaves prior data intact.

## Phase 2 — Authentication and data isolation

1. Add an auth system. Given the existing stack (Next.js App Router + Prisma), the lowest-friction options are Auth.js (NextAuth) with a credentials or OAuth provider, or a hosted provider (Clerk/Supabase Auth) if you'd rather not run session/password logic yourselves.
2. Add a `session`/`user` concept to every relevant API route: `GET/POST /api/trips`, `POST/DELETE /api/itinerary` must scope all reads/writes to `session.userId`, not `findFirst()`/unscoped `findMany()`.
3. Add ownership checks on itinerary item delete/update — verify the item's `trip.userId` matches the session user before mutating.
4. Migrate the one existing shared "Judy User" trip (if worth keeping) to a real account, or drop it as test data.

**Acceptance:** two different browser sessions (logged in as two different users) never see or can mutate each other's trips.

## Phase 3 — Fix or remove broken-but-wired features

1. `PhotoAlbumEditor.tsx` calls two nonexistent routes. Either build `POST /api/photo-albums/digital` and `POST /api/photo-albums/physical-orders` as real Next.js routes backed by Prisma (add `PhotoAlbum`/`PhotoAlbumOrder` models), or remove the feature from the UI until it's ready. Do not ship a button that silently 404s.
2. `ItineraryViewer.tsx` calls `GET /api/recommendations` — same choice: implement it (it's a small Gemini-backed route, straightforward to port from the dead `server.ts` version) or remove the UI affordance.
3. Rebuild `POST /api/contact` to actually persist (new `ContactMessage` Prisma model) and send a real notification (see Phase 5 for SMTP setup), replacing the current console.log-only stub.
4. Decide on the HeyGen "Interactive Avatar" integration: either wire `TravelDaddy.tsx` to call `/api/avatar/session` and render the real avatar stream, or delete `/api/avatar/session` and drop the `HEYGEN_API_KEY` requirement if the 3D placeholder is the intended final experience.

**Acceptance:** every button in the UI that calls an API either succeeds or is disabled/hidden — no silent 404s.

## Phase 4 — Abuse and cost protection

1. Add rate limiting (per-IP and, once Phase 2 lands, per-user) on all Gemini- and Google-API-backed routes: `/api/avatar/chat`, `/api/suggestions`, `/api/places/autocomplete`, `/api/places/details`, `/api/weather`. A simple in-memory or Redis-backed limiter (e.g. `@upstash/ratelimit` if you're already near Vercel/Upstash, or a small custom token-bucket) is enough to start.
2. Require the session from Phase 2 on these routes so usage can be attributed and capped per user, not just per IP.
3. Add request body size/shape validation (zod) on every route that accepts `POST` bodies, replacing the current "trust the JSON" approach.

**Acceptance:** hammering `/api/suggestions` anonymously in a loop gets throttled instead of generating unlimited billed Gemini calls.

## Phase 5 — Deployment and secrets hardening

1. Rewrite `.env.example` to reflect only what the live Next.js app reads (see the Environment Variables appendix below), removing references that belong solely to the dead Express app.
2. Wire real SMTP credentials (`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS`/`SMTP_PORT`) and an `ADMIN_EMAIL` for the contact-form notification rebuilt in Phase 3.
3. Add basic security headers (`next.config.ts` `headers()` — at minimum `X-Frame-Options`, `X-Content-Type-Options`, a CSP if feasible) and a CORS policy if the API will ever be called cross-origin.
4. Confirm the chosen deployment target (Docker or Hostinger) builds and starts cleanly end-to-end with production env vars set, including the `next/font/google` build-time fetch — verify the build host has outbound internet, or switch to a self-hosted/local font to remove the dependency entirely.

**Acceptance:** a fresh clone, with only `.env` populated from the (corrected) `.env.example`, builds and runs in the target environment without manual patching.

## Phase 6 — Observability and safety net

1. Add error tracking (Sentry or similar) so the `console.error` calls throughout the API routes actually surface somewhere.
2. Add at least smoke-level automated tests for the API routes touched in Phases 1–3 (trip CRUD, itinerary CRUD, contact form) and wire a CI workflow (GitHub Actions) to run them plus `npm run lint` and `npm run build` on every PR.
3. Remove the dead code identified in the review (`server.ts`, `src/App.tsx`, `src/main.tsx`, `vite.config.ts`, `capacitor.config.json`, `android/`, `ios/`, `dist/`, and the stale `MOBILE_DEPLOYMENT.md`/`handoff.md`/`BUILDOUT.md`, or move them to a clearly-labeled `/archive` folder with a note that they're historical).
4. Replace `README.md` with real project documentation: what the app does, how to run it locally, required env vars, and the deployment process decided in Phase 0.

**Acceptance:** a new contributor can read `README.md`, set up `.env`, run the app locally, and understand what's live versus archived without reading git history.

---

## Appendix — Environment variables & secrets needed for production

| Variable | Required for | Notes |
|---|---|---|
| `DATABASE_URL` | Core app (Prisma/trips) | Must point at a real hosted DB once Phase 1 lands. Currently **ignored at runtime** — see review Finding #2 — fix before relying on this. |
| `GEMINI_API_KEY` | AI itinerary suggestions, Travel Daddy chat | Google Generative Language API. Both fall back to a canned/offline response if unset, so the app won't crash without it, but the AI features go dead. |
| `GOOGLE_MAPS_API_KEY` | Places autocomplete, place details, weather | Needs Places API (New), Geocoding API, and Weather API enabled in Google Cloud Console. All three current routes hard-fail with a 500 if unset. |
| `HEYGEN_API_KEY` | Interactive avatar session (`/api/avatar/session`) | Currently unused by the UI (see Finding — dead HeyGen integration). Only needed if Phase 3 wires it up; otherwise this key and route can be dropped. |
| `NODE_ENV` | Build/runtime mode switching | Standard; set to `production` by the Dockerfile already. |
| `PORT` | Server bind port | Defaults to 3000; Hostinger/host platform typically injects this. |
| `NEXT_PUBLIC_APP_URL` | Documented, currently unused | Either wire it into the code (e.g. for absolute URLs in emails/shares) or remove from `.env.example`. |

Additional variables only needed **if** the corresponding Phase-3/5 work is done (rebuilding the contact form's email notification and reviving the admin dashboard concept):

| Variable | Required for | Notes |
|---|---|---|
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` / `SMTP_PORT` | Outbound email (contact form, order notifications) | Use an app password or transactional email provider (Postmark, SES, SendGrid SMTP relay) rather than a personal inbox password. |
| `ADMIN_EMAIL` | Destination address for contact-form/order notifications | |
| `ADMIN_KEY` | Protects an admin dashboard route | Only relevant if the admin dashboard concept from the dead `server.ts` is rebuilt in the Next.js app; use a long random value, not a memorable password, and consider a real auth-gated admin role instead of a shared query-string key. |

Secrets that should **never** be committed (confirmed none were found in git history during this review, aside from placeholder strings): actual values for any key above, any future OAuth client secrets, session/JWT signing secrets once Phase 2's auth system is added, and any print-fulfillment or payment-processor API keys if Phase 3 revives those old `BUILDOUT.md` roadmap items (Stripe, Printful/Prodigi, etc.).
