# Agent Build Prompts — Judy (remaining travel-app workstreams)

Copy-paste handoff prompts for an agent (e.g. Antigravity) working in the `judy`
repo at `/Users/robert/Desktop/claude7126/judy`. Each is self-contained, builds
on what already exists, and ends by running the suite. They assume the current
tree (Judy Pierre avatar hub: Translate · Experiences · Memories · Alerts, Gemma
via Hermes, local RAG, budget auto-allocate).

Conventions every prompt must follow:
- Minimal, additive changes; don't refactor unrelated code or touch the Hermes
  security/validation/quota logic.
- New API routes: `runtime = 'nodejs'`, auth-gate with `getSessionUserId()`,
  rate-limit with `enforceRateLimit`, validate bodies with `zod`, fail gracefully.
- Finish with `npm run lint && npm test && npm run build` and report PASS/FAIL.
- Don't commit or push unless told.

---

## 1. Datasets / feeds for the Gemma intel (RAG corpus)

```text
ROLE
Expand Judy's local RAG corpus so Gemma answers are grounded on real gay-travel
knowledge. The pipeline already exists — you're adding data + a refresh path,
not rebuilding it.

WHAT EXISTS
- Sources: data/rag/sources/*.{md,txt,json} (json = array of {id?, text, metadata?}).
- Ingest CLI: `npm run rag:ingest` → chunks + embeds (Gemini gemini-embedding-001)
  → writes data/rag/index/{chunks,embeddings}.json.
- Retrieval: src/lib/rag/retriever.ts `retrieveContext(query)` — already wired
  into the chat route and SEO generator.
- Exporter for a future worker collection: src/lib/hermes/grounding.ts.

TASKS
1. Curate gay-travel knowledge into data/rag/sources/ as multiple well-structured
   files (one topic per paragraph works best). Cover: destination safety & local
   LGBTQ+ laws (framed as "verify with official sources", never stated as legal
   fact), gayborhoods, nightlife/circuit/Pride calendars, beaches/resorts, health
   & travel tips, and budgeting norms by region. Prefer .md for prose and .json
   for structured records with metadata {source, region, tags}.
2. Add a small fetch-and-format script (src/lib/rag/feeds.ts + an npm script
   `rag:feeds`) that pulls from a configurable list of public feeds/URLs the
   owner provides via env or a config file, normalizes them into
   data/rag/sources/*.json, and is safe to re-run (idempotent, dedup by id).
   Do NOT hardcode scraping of sites that disallow it; read a provided allowlist.
3. Run `npm run rag:ingest` and COMMIT the regenerated data/rag/index/ so prod
   has it (the index is currently gitignored-safe to commit; confirm .gitignore).
4. Add a short docs/RAG_SOURCES.md describing the source format and refresh steps.

GUARDRAILS
- No unverified legal/safety absolutes in the data — phrase as guidance.
- Keep each chunk focused; respect the retriever's byte budget.

DELIVERABLE
- New/updated sources, feeds script + npm script, regenerated index, docs.
- Report `npm run lint && npm test && npm run build` PASS/FAIL.
```

---

## 2. Avatar multiple voices + language translations

```text
ROLE
Give Judy Pierre multiple voices and make her speak in the traveler's language,
building on the existing voice + TTS + lip-sync system.

WHAT EXISTS
- Voice catalog: src/lib/voice/catalog.ts; picker UI: src/components/VoiceSettings.tsx.
- TTS + lip-sync: src/lib/avatar/tts.ts, /api/avatar/lipsync, viseme rig in
  src/components/avatar/AvatarMesh.tsx (viseme_A..viseme_X on judyface.glb).
- User prefs: User.voiceId, User.nativeLanguage, User.translationLanguage
  (Prisma). Chat route already does implicit translation routing via
  src/lib/translation-intent.ts + runTravelTranslation.

TASKS
1. Expand src/lib/voice/catalog.ts to a richer set of voices, each tagged with
   language/locale and a personality label; keep the existing IDs stable.
2. In VoiceSettings, let the user pick a voice AND a spoken language; persist via
   the existing /api/user/preferences route (extend its schema if needed —
   additive, nullable).
3. Make the avatar SPEAK in the chosen language: when a reply is produced, if the
   user's spoken language differs from the reply language, translate it via
   runTravelTranslation before TTS, and select a locale-appropriate voice from
   the catalog. Keep the lip-sync path (cues/visemes) working with the spoken
   audio.
4. Ensure graceful fallback: no voice access / translation off → current behavior
   (browser speech or existing default) with no errors.
5. Unit-test the catalog selection (voice-by-language) and any new pure helpers.

GUARDRAILS
- Don't break existing VoiceSettings/TravelDaddy tests; update assertions only if
  you intentionally change user-facing strings.
- Keep the viseme/lip-sync contract intact.

DELIVERABLE
- Expanded catalog, language-aware voice selection + speech, preferences wiring,
  tests. Report `npm run lint && npm test && npm run build` PASS/FAIL.
```

---

## 3. SEO for the site (gay-travel destination pages)

```text
ROLE
Turn the existing SEO generator into real, indexable pages so Judy ranks for
gay-travel destination searches.

WHAT EXISTS
- SEO generator: src/lib/seo/generate.ts (generateDestinationSeo → title,
  description, keywords, h1, intro, JSON-LD; Gemma→Gemini→template) and route
  /api/seo/generate.
- Root metadata + film overlays: src/app/layout.tsx.
- RAG retrieval is available to ground copy.

TASKS
1. Add public, server-rendered destination pages under the App Router, e.g.
   src/app/destinations/[slug]/page.tsx, that:
   - Resolve a slug → destination (a curated list in src/lib/seo/destinations.ts,
     seeded from the experiences catalog cities + top gay destinations).
   - Implement `generateMetadata` using generateDestinationSeo (cache results;
     do NOT call the model on every request — precompute or cache to disk/DB).
   - Render the H1 + landing intro + a tasteful, on-brand (Portra) layout, and
     inject the JSON-LD (schema.org TouristDestination) via a <script type=
     "application/ld+json">.
   - Be PUBLIC (no auth) so crawlers can read them; keep private app routes
     noindex.
2. Add src/app/sitemap.ts (or update public/sitemap.xml) listing the destination
   URLs + key public pages, and update public/robots.txt to allow them while
   blocking private/app routes.
3. Add a build/generation step (npm script `seo:generate`) that precomputes SEO
   for all destinations into a committed JSON (src/lib/seo/precomputed.json) so
   pages render instantly without live model calls; generateMetadata reads that
   with a template fallback.
4. Link destination pages from somewhere public (e.g. a lightweight index page)
   for internal linking.

GUARDRAILS
- No fabricated facts in copy; ground with RAG where possible and keep claims
  general. Never present legal/safety specifics as certainties.
- Keep model calls OUT of the hot request path (precompute/cache).

DELIVERABLE
- Destination route(s), sitemap/robots, precompute script + committed JSON,
  internal-linking index. Report `npm run lint && npm test && npm run build`
  PASS/FAIL and list the new public URLs.
```
