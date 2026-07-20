# Judy Live Deployment Review — judy.lgbt

Reviewed: 2026-07-18, live site, logged-in session, real chat + API probes via browser.

## Verdict

The avatar's **voice pipeline works**; the avatar's **brain does not**. Every chat reply on the live site is the canned fallback ("Hmm, my signal got a little fuzzy there, darling"), so there is currently no reply accuracy to grade — the AI path is down in production.

## What was tested

| Check | Result | Evidence |
|---|---|---|
| Site up, login, dashboard | Pass | Signed in at judy.lgbt; dashboard renders |
| GLB avatar renders | Pass | Purple rhino (Judy Pierre) loads; `/api/avatar/model` 200, 4.9 MB GLB |
| Voice (stage 2: ElevenLabs + Rhubarb) | **Pass** | `/api/avatar/lipsync` returns 200 with real WAV audio (65 KB for a short line), 7 viseme cues, `spokenLanguage`, `voiceId`. With voice enabled in Settings, replies trigger lipsync playback and captions. |
| Voice default state | Off by default | `judy-speech-synthesis-enabled` localStorage flag is false until enabled in Settings — silent avatar for new users |
| Chat reply accuracy | **Fail (0/3)** | Three questions (Lisbon visa/currency ×2, "thank you in Portuguese") all returned the fallback line. `/api/avatar/chat` returns 200 with fallback text by design, masking the failure. |
| Chat latency | Fail | The Portuguese question took ~50–55 s before falling back (Hermes translation path timing out) |
| HeyGen "Go live" | **Fail** | `/api/avatar/session` → 502 "Failed to create avatar session" |
| Weather widget | Fail | `/api/weather` returns `{current:null, forecast:null}`; widget shows "—" |
| Trip countdown | Bug | Shows 0d 0h 0m with "-4 days until departure" (trip date is in the past; negative value leaks into UI) |
| Auth redirect | **Bug** | An unauthenticated visit to judy.lgbt rendered the dashboard shell, then redirected to `https://0.0.0.0:3000/login` — a dev host is leaking into production auth/redirect config |

## Root-cause analysis

1. **Gemini key/SDK mismatch.** The active `GEMINI_API_KEY` (`AQ.…`) is a **Vertex AI express-mode key** (service account `geminipet@vertex1-490112`, created 2026-06-08). But the app uses the legacy `@google/generative-ai` SDK, which calls the **Gemini Developer API** (`generativelanguage.googleapis.com`) — that endpoint requires an AI Studio key (`AIza…`). Express keys are rejected there, the chat route's catch-all swallows the error, and every reply becomes the fallback with HTTP 200. Fix either by (a) minting an AI Studio key at aistudio.google.com/apikey and setting it as `GEMINI_API_KEY` in the Hostinger panel — smallest change, no code — or (b) migrating to the `@google/genai` SDK with Vertex/express support (code change in chat, RAG embeddings, and SEO generation). Also remove the duplicate `GEMINI_API_KEY` line in `.env`. Weather nulls are separate (`GOOGLE_MAPS_API_KEY`).
2. **HeyGen key invalid/missing or account issue** → 502 on session create.
3. **Hermes translation path adds ~30–50 s** before falling back (known 9 s knowledge budget vs ~20 s worker latency, plus translation polling), compounding the broken-chat experience.
4. **Prod auth/base-URL config contains a dev host** (`0.0.0.0:3000`) — check `AUTH_URL`/`NEXTAUTH_URL`/trustHost on Hostinger.

## Next steps (priority order)

1. **Fix `GEMINI_API_KEY` in production** (and remove the duplicate line in any env file): one valid `AIza…` key only. This should restore chat replies immediately. Verify with one question — a real answer instead of the "fuzzy" line.
2. **Fix the `0.0.0.0:3000` login redirect**: set `AUTH_URL=https://judy.lgbt` (and check any hardcoded base URL) in the Hostinger panel; retest logout → login flow.
3. **Verify `GOOGLE_MAPS_API_KEY`** and that Places/Geocoding/Weather APIs are enabled — the weather card is empty.
4. **HeyGen**: confirm `HEYGEN_API_KEY` validity/credits or hide the "Go live" button while it 502s.
5. **Add fallback observability** (P1 from the 2026-07-16 review, now proven urgent): log fallback reason on `/api/avatar/chat` — three days of total chat failure was invisible because the endpoint returns 200.
6. **Latency**: raise the knowledge budget or cut the Hermes path out of chat until the worker meets the 9 s budget; 50 s to a fallback is the worst-case UX.
7. Minor: clamp negative "days until departure"; consider enabling voice by default (or a first-run prompt) since the ElevenLabs+Rhubarb pipeline is the polished part and most users will never find the Settings toggle.

## Notes

- Voice quality/language routing (`spokenLanguage`, `voiceId` in the lipsync payload) is wired and responding; once chat is fixed, spot-check the language-aware voices added in `09c7c34`.
- Reply-accuracy testing is blocked until step 1 lands — rerun the question set afterwards (visa/currency facts, LGBTQ+ safety questions, translation requests).
