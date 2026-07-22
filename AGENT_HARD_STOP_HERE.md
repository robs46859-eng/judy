# Judy Deployment and Avatar Backend Audit

> **Agent hard stop:** Read this report before changing Judy's avatar, voice, RAG, migrations, Hermes routing, or production configuration. Do not assume that a green build proves camera orientation, voice differentiation, semantic retrieval, or live lip-sync behavior.

## Executive result

The current Judy deployment is online and GitHub Actions is green. The avatar, chat, voice, translation, and lip-sync backend is connected coherently, and production has ElevenLabs and Rhubarb Lip Sync 1.14.0 available.

The major visible defect is confirmed: **the GLB is not facing the camera**. The live avatar is rendered in a right-facing side profile because the application preserves the model's imported orientation and never rotates or normalizes it.

Other important findings:

- Precise lip-sync is implemented and its production prerequisites are present.
- The 17 logical voice choices currently resolve to one global ElevenLabs voice, so the choices will not produce distinct personalities until provider voice mappings are added.
- The deployed RAG embeddings file is empty, so Judy is using keyword retrieval instead of semantic vector retrieval.
- HeyGen has API access but no explicit avatar or voice ID and therefore depends on account defaults.
- Chat is stateless between messages: previous conversation turns are displayed in the browser but are not sent back to Gemma or Gemini.
- The production database contains the additive `User.spokenLanguage` column required by the current voice implementation.

No application files were changed during the audit that produced these findings.

## Deployment status

- Latest GitHub `main`: `ae240f43de02440dcccf7213508ff33d914905db`
- Latest GitHub Actions CI: **PASS**
- CI run: <https://github.com/robs46859-eng/judy/actions/runs/29655616888>
- Language-aware voice commit: `09c7c34d63d57b5be5def629763acec2dd345899`
- Voice commit CI: **PASS**
- Voice CI run: <https://github.com/robs46859-eng/judy/actions/runs/29655565872>
- Production URL: <https://judy.lgbt/>
- Live authenticated dashboard: **loaded successfully**
- Production `User.spokenLanguage` column: **present**
- Rhubarb: **version 1.14.0, present, and executable**

Hostinger's deployed application directory does not retain Git metadata, so the exact deployed SHA cannot be independently read from that directory. The deployed `judyface.glb` SHA-256 matches the repository asset exactly.

## Highest-priority findings

### 1. Judy does not face the camera

**Status: FAIL**

The live GLB faces screen-right in profile. The camera itself is centered correctly. The defect is the model orientation, not the camera position.

The model is rendered directly without a corrective transform:

```tsx
<primitive object={scene} />
```

There is no:

- `rotation`
- `lookAt`
- orientation metadata
- front-facing upload validation
- corrective parent group

The likely correction for the current asset is approximately:

```tsx
<group rotation={[0, -Math.PI / 2, 0]}>
  <primitive object={scene} />
</group>
```

That value must be visually verified. The durable solution is to standardize uploaded GLBs to one forward-axis convention or persist a per-avatar `rotationY` value in the avatar manifest.

### 2. The voice catalog does not yet produce distinct voices

The application exposes 17 logical voices across 12 languages. Production only has the global `ELEVENLABS_VOICE_ID`; it does not have catalog-specific `ELEVENLABS_VOICE_*` mappings.

As a result, language and personality selection changes the logical voice metadata, but every choice currently falls back to the same ElevenLabs provider voice.

Examples of mappings required for genuinely distinct voices:

```text
ELEVENLABS_VOICE_JUDY_ELEGANT_FR
ELEVENLABS_VOICE_JUDY_GENTLE_JA
ELEVENLABS_VOICE_JUDY_WARM_ES_MX
```

### 3. Semantic RAG retrieval is inactive

The deployed RAG index contains:

- 15 text chunks
- 7 source files
- An `embeddings.json` file containing `[]`

Because there are no stored vectors, the request-time retriever does not call `gemini-embedding-001`. It uses keyword-overlap scoring instead. This is functional but less accurate and less context-aware than semantic retrieval.

### 4. Conversation history is not sent to the model

The browser displays the chat history, but `/api/avatar/chat` receives only the current message and current trip context. Previous user and Judy messages are not included.

Judy therefore cannot reliably resolve references such as:

- "What about the second place?"
- "Translate that too."
- "Is it safer than the first one?"

### 5. HeyGen is not explicitly configured

Production has `HEYGEN_API_KEY`, but no explicit:

- `HEYGEN_AVATAR_ID`
- `HEYGEN_VOICE_ID`
- Per-catalog `HEYGEN_VOICE_*` mappings

The code omits those fields and relies on HeyGen account defaults. That may work when valid defaults exist, but it is not deterministic and may fail at `streaming.new`.

## Models and assets currently used

| Layer | Model or asset | When it is used |
|---|---|---|
| Local 3D avatar | `public/models/judyface.glb` | Default visual avatar |
| Local fallback | `public/avatars/robjudy.jpg` | Only if GLB or WebGL rendering fails |
| Primary LLM | `gemma-4-e2b` | Normal knowledge chat and translation through Hermes |
| Chat fallback | `gemini-2.0-flash` | When Hermes is disabled, unavailable, timed out, or quota-limited |
| RAG embeddings | `gemini-embedding-001` | Intended for ingest and semantic retrieval; currently inactive because the vector index is empty |
| TTS | ElevenLabs `eleven_flash_v2_5` | Local GLB speech when read-aloud is enabled |
| Lip-sync analyzer | Rhubarb Lip Sync 1.14.0 | Converts the generated ElevenLabs WAV into mouth cues |
| Optional live avatar | HeyGen Streaming Avatar v2 | Replaces the local GLB after the traveler presses **Go live** |

## Current GLB contents

The deployed `public/models/judyface.glb` contains:

- 24 nodes
- 1 mesh
- 1 skin
- 1 material
- A `jaw` bone
- `viseme_A` through `viseme_H`
- `viseme_X`
- Zero embedded animation clips

The avatar can animate its mouth, but the GLB provides no idle animation, blinking, head movement, gestures, or body animation.

The avatar upload inspector validates structural integrity, skinning, and lip-sync compatibility. It does not validate model orientation, pivot, framing, face visibility, idle animations, or default morph weights.

## Camera and UI positioning

The Three.js camera is configured as follows:

- Position: `[0, 0, 2.4]`
- Field of view: `28`
- Near plane: `0.05`
- Far plane: `100`
- The camera points toward the scene origin
- `<Bounds fit clip observe margin={1.12}>` automatically scales and centers the GLB

The bounds helper scales and centers the asset but does not rotate it. The imported GLB orientation is preserved.

### Live desktop measurements

At a 1224 by 836 browser viewport:

- Main content: 1152 by 763
- Avatar area: 720 by 715 on the left
- Weather and countdown column: 360 by 715 on the right
- The WebGL canvas fills the entire avatar area

The GLB, fallback portrait, and HeyGen video all share the same avatar layout box. The HeyGen video uses `object-fit: cover`, so a live provider avatar may be cropped differently from the local GLB.

### Responsive positioning

Below 1024 pixels:

- The main layout becomes vertical
- The avatar becomes full width
- The avatar minimum height becomes 60vh
- Widgets move below the avatar

At 480 pixels and below, the avatar minimum height becomes 50vh.

## Lip-sync and speech status

### Local GLB path

Precise synchronization is implemented when ElevenLabs and Rhubarb both succeed:

1. `/api/avatar/chat` returns Judy's reply.
2. The browser calls `/api/avatar/lipsync` when read-aloud is enabled.
3. The server optionally translates the speech-only copy into the saved spoken language.
4. ElevenLabs generates raw 24 kHz PCM.
5. The server wraps the PCM as WAV.
6. The same WAV and exact spoken text are sent to Rhubarb.
7. Rhubarb returns A-H/X mouth cues.
8. The API returns the WAV and cues together.
9. The browser starts the cue clock from the audio element's `play` event.
10. `AvatarMesh` updates the GLB morph targets on every rendered frame.

This design synchronizes the visible mouth timeline with the exact audio Rhubarb analyzed.

Production contains:

- `TTS_PROVIDER=elevenlabs`
- An ElevenLabs API key
- A global ElevenLabs voice ID
- `ELEVENLABS_MODEL_ID=eleven_flash_v2_5`
- An executable Rhubarb 1.14.0 binary

The audit did not generate a paid production utterance. It confirms the deployed code and prerequisites, not a billed end-to-end speech transaction.

### Fallback behavior

- ElevenLabs unavailable: the browser Web Speech API is used.
- Rhubarb unavailable: ElevenLabs audio still plays, but the avatar uses approximate mouth motion.
- Read-aloud disabled: no audio plays; the avatar performs an estimated talking motion.
- HeyGen live session active: HeyGen renders its own video lip-sync and bypasses the local GLB/Rhubarb animation path.

### Caption mismatch risk

Speech preparation may translate the audio into the saved spoken language while the visible chat bubble retains the original reply. The `/api/avatar/lipsync` response includes `spokenText`, but the successful audio path does not add that translated speech text to the visible transcript.

## Voice selection and language routing

The database stores:

- `User.voiceId`
- `User.spokenLanguage`

The read-aloud switch is stored only in browser local storage under:

```text
judy-speech-synthesis-enabled
```

Speech preparation performs these steps:

1. Read the saved voice and spoken language.
2. Compare the reply language with the chosen spoken language.
3. Use Hermes translation when the languages differ.
4. Select a locale-compatible logical voice.
5. Send the prepared text and voice selection to the configured TTS provider.

If translation fails, speech falls back to the original reply and a safe voice. Translation failure is not allowed to prevent Judy from responding.

The Settings label says "Read replies aloud (browser voice, when not live)," but the current implementation tries ElevenLabs and Rhubarb before browser speech. That label is inaccurate.

## Script generation

The client sends `/api/avatar/chat`:

```json
{
  "message": "the current user message",
  "tripContext": "the current trip"
}
```

The server builds a Judy Pierre system prompt instructing the model to be:

- A purple rhino
- Warm, protective, and LGBTQ+-focused
- Knowledgeable about safety, nightlife, culture, dining, and experiences
- Concise, normally two to four sentences
- Plain-spoken without Markdown

The prompt can receive:

- Current user message
- Trip name and destination
- Departure and return dates
- Total and spending budgets
- Itinerary titles
- Native language
- Translation language
- Travel route
- Pre-travel tasks
- Help preference
- Up to three retrieved RAG chunks
- Curated experiences context when the request concerns things to do

The prompt says Judy speaks English and Spanish, while the voice catalog supports 12 languages. Speech translation can produce other languages, but the conversational persona prompt has not been updated to reflect the expanded language capability.

## Intelligence routing

Normal chat follows this order:

1. Detect explicit translation requests or supported script mismatches.
2. If translation intent is detected, submit a Hermes translation job.
3. Otherwise retrieve local travel context.
4. Add curated experience data when relevant.
5. Submit a Hermes knowledge job to Gemma.
6. If Hermes fails, times out, is disabled, or reaches quota, call Gemini.
7. Return a friendly HTTP 200 fallback response if the full chat operation throws.

The local RAG sources cover:

- Safety guidance
- Health tips
- Budgeting norms
- Gayborhoods
- Beaches and resorts
- Nightlife and events
- Gay travel seed knowledge

Translation detection is not full language detection. It handles explicit translation phrases and selected non-Latin script mismatches. Latin-script languages that are not explicitly requested may proceed through normal chat rather than the translation route.

## Backend mapping

| Browser or API | Backend destination | Purpose |
|---|---|---|
| Static `/models/judyface.glb` | Hostinger public asset | Current 3D avatar |
| `/api/avatar/model` | Persistent avatar manifest and asset storage | Serves an uploaded replacement when one exists |
| `/api/avatar/chat` | Hermes, then Gemini fallback | Generates Judy's conversational response |
| `/api/avatar/lipsync` | Hermes translation, ElevenLabs, then Rhubarb | Generates spoken audio and local GLB mouth cues |
| `/api/avatar/session` | HeyGen `streaming.new` and `streaming.start` | Starts the optional live avatar |
| `/api/avatar/speak` | Hermes translation, then HeyGen `streaming.task` | Makes the live HeyGen avatar repeat the response |
| `/api/avatar/stop` | HeyGen `streaming.stop` | Ends the live avatar session |
| `/api/user/preferences` | Turso through Prisma | Stores voice and spoken-language preferences |
| `/api/hermes/translate` | Hermes relay queue | Powers the explicit translation panel |
| `/api/hermes/knowledge` | Hermes relay queue | Submits direct knowledge jobs |
| `/api/hermes/jobs/:id` | Turso job mirror and Hermes relay | Polls or cancels queued jobs |

Hermes knowledge requests are mapped to the `judy-travel` collection. Translation requests use automatic source-language detection when a source is not explicitly known.

The effective inference chain is:

```text
Browser
  -> Hostinger Next.js API route
  -> local Turso HermesJob record
  -> Hermes relay on the VPS
  -> relay PostgreSQL queue
  -> Pixel worker
  -> gemma-4-e2b
  -> relay
  -> Hostinger
  -> browser
```

The browser never receives the Hermes producer secret or third-party provider keys.

## Database and migration mapping

The language-aware voice feature added the nullable column:

```sql
ALTER TABLE "User" ADD COLUMN "spokenLanguage" TEXT;
```

The migration is stored at:

```text
prisma/migrations/20260718120000_add_user_spoken_language/migration.sql
```

A read-only query confirmed that `spokenLanguage` is present in the production database. No database changes were made during this audit.

## Recommended next steps

### Required before avatar close-out

1. Add a corrective Y-axis rotation for the current `judyface.glb` and visually verify Judy in desktop and mobile layouts.
2. Extend the avatar manifest with an orientation value such as `rotationY`, or enforce one forward-axis convention for every uploaded GLB.
3. Add an upload preview that requires the administrator to confirm a front-facing view before activation.
4. Validate orientation, pivot, camera framing, default morph weights, and face visibility in addition to the existing structural and lip-sync checks.
5. Run an authenticated production speech test that confirms ElevenLabs returns audio, Rhubarb returns non-empty cues, and the visible mouth starts with the audio `play` event.
6. Verify silence returns `viseme_X` and that every other cue visibly changes the correct morph target.
7. Add a neutral idle pose, blinking, and subtle head/body motion without altering the lip-sync morph targets.

### Required for a real multi-voice experience

1. Select and approve actual ElevenLabs provider voices for every supported language or personality that should sound distinct.
2. Add the corresponding `ELEVENLABS_VOICE_<CATALOG_ID>` variables in Hostinger.
3. Test each voice with its native language and verify pronunciation, pacing, and Rhubarb cue quality.
4. Rename the read-aloud setting so it accurately describes ElevenLabs with browser fallback.
5. Show the actual spoken translation in the transcript or clearly label that the spoken audio differs from the displayed reply.
6. Decide whether changing a voice should take effect immediately or require returning to the dashboard; the current component reads the local speech toggle only when it mounts.

### Required for stronger Judy intelligence

1. Re-run `npm run rag:ingest` with `GEMINI_API_KEY` available.
2. Verify `data/rag/index/embeddings.json` contains one non-empty vector for each of the 15 chunks.
3. Commit the populated embeddings index so Hostinger receives semantic retrieval data during deployment.
4. Add a bounded, sanitized conversation-history array to `/api/avatar/chat` so Judy can understand follow-up questions.
5. Limit retained history by message count and character budget before sending it to Hermes or Gemini.
6. Expand the system prompt so Judy's conversational language behavior matches the 12-language voice catalog.
7. Add deterministic language identification for supported Latin-script languages instead of relying only on explicit translation phrases and non-Latin script detection.
8. Add source metadata to retrieved chunks so responses can be audited and future UI citations can be supported.

### Required for predictable live-avatar behavior

1. Set an explicit `HEYGEN_AVATAR_ID` in Hostinger.
2. Set an explicit `HEYGEN_VOICE_ID` or catalog-specific `HEYGEN_VOICE_*` mappings.
3. Test `streaming.new`, `streaming.start`, `streaming.task`, and `streaming.stop` with the production account.
4. Confirm the HeyGen video faces the camera and is not improperly cropped by `object-fit: cover`.
5. Hide or disable **Go live** with a clear message if the required HeyGen identity configuration is absent.
6. Require a fresh live session after a voice change so the session cannot continue using the previously selected provider voice.

### Code and naming cleanup

1. Rename the internal `TravelDaddy` component to `JudyPierre` or another Judy-specific name.
2. Replace internal message roles such as `daddy` with a neutral `assistant` or `judy` role.
3. Remove stale comments that refer to Travel Daddy or old swarm stages after behavior is covered by tests.
4. Preserve API compatibility while renaming internal code; do not combine the rename with camera, voice, or backend behavior changes.
5. Add automated tests for camera-orientation metadata, conversation-history budgeting, voice-provider mapping, and non-empty RAG embeddings.

### Deployment acceptance checks

The deployment should not be considered fully closed until all of the following are true:

- Judy faces the camera on desktop and mobile.
- The local GLB loads without falling back to the portrait.
- A production utterance returns audible ElevenLabs audio.
- Rhubarb returns non-empty cues for normal speech.
- Mouth movement begins with audio playback and returns to neutral afterward.
- At least two catalog voices produce audibly different provider voices.
- A selected non-English spoken language produces translated speech.
- The transcript clearly represents or labels the text Judy actually speaks.
- `embeddings.json` contains vectors and semantic retrieval is exercised.
- Judy can answer a follow-up question using bounded conversation history.
- HeyGen either starts reliably with an explicit avatar identity or is clearly unavailable in the UI.
- Lint, tests, production build, GitHub Actions, and the live dashboard smoke test all pass.

## Relevant implementation files

- `src/app/page.tsx` — selects the active avatar asset
- `src/components/Dashboard.tsx` — positions the avatar and widgets
- `src/components/TravelDaddy.tsx` — chat, speech, HeyGen, and avatar UI orchestration
- `src/components/avatar/AvatarStage.tsx` — Three.js canvas, camera, lighting, and bounds
- `src/components/avatar/AvatarMesh.tsx` — GLB loading and viseme/jaw animation
- `src/components/VoiceSettings.tsx` — voice, spoken-language, and read-aloud settings
- `src/app/api/avatar/chat/route.ts` — script generation and model routing
- `src/app/api/avatar/lipsync/route.ts` — TTS and Rhubarb pipeline
- `src/app/api/avatar/session/route.ts` — HeyGen live-session creation
- `src/app/api/avatar/speak/route.ts` — HeyGen speech tasks
- `src/lib/avatar/tts.ts` — ElevenLabs provider integration
- `src/lib/avatar/rhubarb.ts` — Rhubarb execution
- `src/lib/avatar/speech-preparation.ts` — language-aware speech preparation
- `src/lib/voice/catalog.ts` — approved voice catalog and provider mapping names
- `src/lib/rag/retriever.ts` — semantic or keyword retrieval
- `src/lib/rag/embeddings.ts` — Gemini embedding integration
- `src/lib/hermes/client.ts` — Judy-to-Hermes payload mapping
- `prisma/migrations/20260718120000_add_user_spoken_language/migration.sql` — additive spoken-language migration
x`x`