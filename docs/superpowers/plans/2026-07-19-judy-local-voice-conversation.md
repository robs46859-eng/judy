# Judy Local Voice Conversation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make local 3D Judy a clear, camera-facing, speaking, moving, and automatically listening travel companion with visible live transcripts and accessible text/translation controls.

**Architecture:** A client-side half-duplex conversation state machine owns the `idle → welcoming → listening → thinking → speaking` loop. Native Web Speech Recognition is preferred; unsupported or service-failed recognition falls back to ElevenLabs Scribe v2 Realtime using a server-minted single-use token, while the existing ElevenLabs WAV plus Rhubarb cue path remains the only local speech/lip-sync source. DOM overlays contain all controls and transcripts; React Three Fiber receives only a small conversation-phase signal for per-frame procedural rig motion.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest/Testing Library, React Three Fiber, Three.js, ElevenLabs TTS, ElevenLabs Scribe v2 Realtime, Rhubarb Lip Sync, Hermes/Gemma with Gemini fallback.

## Global Constraints

- Local `judyface.glb` is the primary avatar; the sunset HeyGen streaming flow must not be presented as an active feature.
- One explicit **Talk with Judy** click unlocks audio and microphone access; there is no autoplay before user interaction.
- The microphone is always stopped or muted while Judy is speaking, preventing self-transcription.
- Automatic listening resumes after Judy finishes until **End conversation** is pressed.
- Interim transcription is visible. **Stop** preserves it in an editable textarea with **Send** and **Resume listening**.
- Normal finalized speech auto-submits without a confirmation gate.
- Browser recognition is preferred. ElevenLabs Scribe v2 Realtime is the fallback for unsupported/service-failed recognition, not for denied microphone permission.
- Never expose `ELEVENLABS_API_KEY`; the browser receives only a single-use `realtime_scribe` token.
- Do not persist raw microphone audio or voice transcripts outside the existing visible chat state.
- Preserve exact ElevenLabs WAV/Rhubarb cue synchronization and all existing graceful fallbacks.
- Preserve `prefers-reduced-motion`; reduced-motion users get mouth motion only, without idle/head/body motion.
- Do not claim true blinking: the current GLB has eye bones but no eyelid bones or blink morph targets.
- No database migration is required.
- Do not alter Hermes security, validation, quotas, or producer-secret handling.

---

## Milestone 1: Conversation state machine

**Files:**
- Create: `src/components/avatar/conversationMachine.ts`
- Test: `src/components/avatar/__tests__/conversationMachine.test.ts`

**Interfaces:**

```ts
export type ConversationPhase =
  | 'idle'
  | 'welcoming'
  | 'listening'
  | 'editing'
  | 'thinking'
  | 'speaking'
  | 'paused'
  | 'error';

export interface ConversationState {
  phase: ConversationPhase;
  sessionActive: boolean;
  interimTranscript: string;
  finalTranscript: string;
  error: string | null;
}

export type ConversationEvent =
  | { type: 'START' }
  | { type: 'WELCOME_FINISHED' }
  | { type: 'INTERIM'; text: string }
  | { type: 'COMMIT'; text: string }
  | { type: 'STOP_LISTENING' }
  | { type: 'EDIT'; text: string }
  | { type: 'SUBMIT' }
  | { type: 'REPLY_READY' }
  | { type: 'SPEECH_FINISHED' }
  | { type: 'RESUME' }
  | { type: 'END' }
  | { type: 'FAIL'; message: string };

export const INITIAL_CONVERSATION_STATE: ConversationState;
export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent
): ConversationState;
```

- [ ] Write reducer tests proving START enters welcoming, welcome completion enters listening, committed text enters thinking, Stop preserves editable text, speaking completion resumes listening, and End clears the session.
- [ ] Run `npm test -- src/components/avatar/__tests__/conversationMachine.test.ts` and confirm failures are caused by the missing module.
- [ ] Implement the minimal pure reducer, ignoring phase-invalid events rather than throwing.
- [ ] Re-run the focused test and all avatar component tests.
- [ ] Commit only the reducer and its tests.

## Milestone 2: Clear conversation dock and controls

**Files:**
- Create: `src/components/avatar/ConversationDock.tsx`
- Test: `src/components/avatar/__tests__/ConversationDock.test.tsx`
- Modify: `src/components/TravelDaddy.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

```ts
interface ConversationDockProps {
  state: ConversationState;
  onStart(): void;
  onStopListening(): void;
  onTranscriptChange(text: string): void;
  onSubmit(): void;
  onResume(): void;
  onEnd(): void;
}
```

- [ ] Test that idle renders one prominent **Talk with Judy** button and a one-sentence explanation.
- [ ] Test status copy for welcoming, listening, thinking, speaking, paused, and error states.
- [ ] Test that listening shows live interim/final text plus **Stop** and **End conversation**.
- [ ] Test that editing shows a textarea plus **Send**, **Resume listening**, and **End conversation**.
- [ ] Verify tests fail before creating the component.
- [ ] Implement `ConversationDock` as a DOM overlay below the avatar face, not inside the WebGL canvas.
- [ ] Replace the visible legacy **Go live** control with the dock; leave old HeyGen routes untouched for compatibility but stop calling them from the primary UI.
- [ ] Keep typed chat available and link **Type instead** to the existing chat panel.
- [ ] Add mobile styling as a sticky bottom sheet within the avatar card and desktop styling as a centered bottom dock.
- [ ] Re-run focused tests, `TravelDaddy` tests, and Dashboard tests.

## Milestone 3: Browser recognition and automatic half-duplex loop

**Files:**
- Create: `src/components/avatar/useBrowserRecognition.ts`
- Test: `src/components/avatar/__tests__/useBrowserRecognition.test.tsx`
- Modify: `src/components/TravelDaddy.tsx`
- Retire from primary flow: `src/components/avatar/VoiceInputButton.tsx`

**Interfaces:**

```ts
export type RecognitionFailure =
  | 'unsupported'
  | 'permission-denied'
  | 'service-failed'
  | 'no-microphone'
  | 'no-speech';

interface BrowserRecognitionOptions {
  language: string;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onFailure(reason: RecognitionFailure, message: string): void;
  onEnd(): void;
}

interface BrowserRecognitionController {
  supported: boolean;
  listening: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}
```

- [ ] Write hook tests using the existing mock SpeechRecognition pattern for interim text, final text, Stop, abort, permission denial, network/service failure, and unmount cleanup.
- [ ] Verify failures occur before the hook exists.
- [ ] Implement a single non-continuous recognition turn with `interimResults=true` and the saved spoken locale.
- [ ] Wire final results directly to the reducer and `sendMessage`; do not add an approval timer.
- [ ] Make **Stop** call recognition.stop and enter editing without auto-submit.
- [ ] Abort recognition before welcome/reply audio begins; restart only from audio/browser-TTS completion.
- [ ] Pause recognition when the document becomes hidden and resume only when visible if the session remains active.
- [ ] Treat permission denial and no microphone as typed-mode errors; send unsupported/network/service failures to the Scribe fallback milestone.
- [ ] Re-run hook and `TravelDaddy` tests.

## Milestone 4: ElevenLabs Scribe v2 Realtime fallback

**Files:**
- Create: `src/app/api/avatar/transcription-token/route.ts`
- Test: `src/app/api/avatar/transcription-token/__tests__/route.test.ts`
- Create: `src/components/avatar/useScribeFallback.ts`
- Test: `src/components/avatar/__tests__/useScribeFallback.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**

```http
POST /api/avatar/transcription-token
200 { "token": "single-use token" }
401 { "error": "Authentication required" }
429 { "error": "..." }
501 { "error": "Voice transcription is not configured" }
502 { "error": "Could not start voice transcription" }
```

```ts
interface ScribeFallbackOptions {
  languageCode?: string;
  onInterim(text: string): void;
  onFinal(text: string): void;
  onFailure(message: string): void;
}
```

- [ ] Add failing route tests for auth, rate limiting, missing key, upstream failure, invalid upstream payload, no-store headers, and successful token pass-through.
- [ ] Implement a server-only POST to `https://api.elevenlabs.io/v1/single-use-token/realtime_scribe` with `xi-api-key`, returning only the token.
- [ ] Install pinned `@elevenlabs/react@1.10.1`; do not expose or serialize the API key.
- [ ] Add failing fallback-hook tests for token fetch, partial transcript, committed transcript, Stop/disconnect, and provider errors.
- [ ] Implement `useScribe` with `modelId: 'scribe_v2_realtime'`, VAD commit strategy, `vadSilenceThresholdSecs: 1.0`, `echoCancellation: true`, `noiseSuppression: true`, and language detection.
- [ ] Choose native browser recognition first. Activate Scribe only when browser recognition is unsupported or reports service/network failure.
- [ ] Never switch to Scribe after permission denial because the same microphone permission is required.
- [ ] Disconnect Scribe before Judy audio and after End conversation.
- [ ] Re-run route, hook, component, and full tests.

## Milestone 5: Spoken welcome and reliable speech lifecycle

**Files:**
- Modify: `src/components/TravelDaddy.tsx`
- Modify: `src/components/VoiceSettings.tsx`
- Modify: `src/components/__tests__/TravelDaddy.test.tsx`

**Behavior:**

The first user click speaks this concise orientation through the normal `/api/avatar/lipsync` path:

> Hi, I’m Judy Pierre, your travel translator and guide. Ask me about your trip, say a phrase to translate, or ask what to do nearby. I’ll listen after I finish speaking; tap Stop whenever you want to edit what I heard.

- [ ] Write failing tests proving no audio starts on mount, Talk starts the welcome, the microphone remains off during speech, and audio completion begins listening.
- [ ] Write failing tests proving every generated reply uses `/api/avatar/lipsync` during an active conversation regardless of the old local-storage toggle.
- [ ] Refactor `speakWithLipSync` and browser fallback to resolve a Promise only when playback ends/errors, so the reducer owns the transition back to listening.
- [ ] Preserve `audio.onplay` as the only start point for viseme cues and `isTalking`.
- [ ] Store read-aloud as enabled after the explicit Talk click; rename the setting to **Speak Judy’s replies automatically**.
- [ ] On TTS/Rhubarb failure, use browser speech and resume listening from `utterance.onend`; on total speech failure, show the reply and return to listening without looping errors.
- [ ] Re-run synchronized speech, VoiceSettings, and TravelDaddy tests.

## Milestone 6: Reply captions, Copy, translation, and Speak translation

**Files:**
- Create: `src/components/avatar/ReplyActions.tsx`
- Test: `src/components/avatar/__tests__/ReplyActions.test.tsx`
- Modify: `src/components/TravelDaddy.tsx`
- Modify: `src/app/globals.css`

**Interfaces:**

```ts
interface ReplyActionsProps {
  originalText: string;
  originalLanguage?: string | null;
  onSpeak(text: string, language?: string): Promise<void>;
}
```

- [ ] Test Copy success and a visible copy-failure message when Clipboard API is unavailable.
- [ ] Test the dropdown contains the approved spoken-language catalog and does nothing until a language is selected.
- [ ] Test translation submits through the existing authenticated Hermes translation queue and shows original plus translated text.
- [ ] Test **Speak translation** is disabled until translation succeeds and calls `onSpeak` only on explicit click.
- [ ] Implement reply actions on every Judy message and the live speaking caption.
- [ ] Keep the original visible after translation and make status/error text accessible with `aria-live`.
- [ ] Pause listening while **Speak translation** plays and resume only after playback completes.
- [ ] Re-run ReplyActions, Hermes route, and TravelDaddy tests.

## Milestone 7: Camera-facing procedural avatar movement

**Files:**
- Create: `src/lib/avatar/motion.ts`
- Test: `src/lib/avatar/__tests__/motion.test.ts`
- Modify: `src/components/avatar/AvatarMesh.tsx`
- Modify: `src/components/avatar/AvatarStage.tsx`
- Modify: avatar URL/props through `src/app/page.tsx`

**Interfaces:**

```ts
export interface AvatarMotionSample {
  rootY: number;
  rootScale: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  earRoll: number;
  chestPitch: number;
}

export function sampleAvatarMotion(
  phase: ConversationPhase,
  elapsedSeconds: number,
  reducedMotion: boolean
): AvatarMotionSample;
```

- [ ] Write failing pure tests for bounded, deterministic idle/listening/thinking/speaking samples and zero non-mouth movement under reduced motion.
- [ ] Implement restrained sine-based samples: idle breathing, listening forward attention/ear motion, thinking head tilt, and speaking head/chest emphasis.
- [ ] Capture head, neck, ear, chest, and spine bind quaternions once; apply additive deltas in `useFrame` and restore bind poses on cleanup.
- [ ] Keep jaw/viseme animation independent and higher priority than procedural movement.
- [ ] Rotate only the bundled `judyface.glb` approximately `-Math.PI / 2` around Y; uploaded avatars default to their authored orientation unless future manifest metadata specifies otherwise.
- [ ] Pass conversation phase into `AvatarStage`/`AvatarMesh` without pushing per-frame state through React.
- [ ] Do not animate eye rotations as blinking and do not overdrive limbs.
- [ ] Run motion/rig/viseme tests and visually verify front-facing layout at desktop and mobile widths.

## Milestone 8: Conversation history and understandable onboarding

**Files:**
- Modify: `src/lib/schemas.ts`
- Modify: `src/app/api/avatar/chat/route.ts`
- Modify: `src/components/TravelDaddy.tsx`
- Test: add chat-schema and route coverage in the nearest existing suites

**Wire shape:**

```ts
history?: Array<{
  role: 'user' | 'assistant';
  text: string; // maximum 800 characters
}>; // maximum 8 messages
```

- [ ] Write failing schema tests for valid history, role rejection, item length, and maximum message count.
- [ ] Send the last eight visible turns, excluding the new current message and any partial transcript.
- [ ] Format history under a 4,000-character server budget and add it as grounding for both Hermes and Gemini.
- [ ] Keep translation-intent detection scoped to the current user message.
- [ ] Add three visible suggestion buttons near **Talk with Judy**: **Plan my trip**, **Translate a phrase**, and **What should I do nearby?**
- [ ] Clicking a suggestion starts/opens the appropriate conversation path without calling a model before user intent is clear.
- [ ] Update the Judy persona prompt to support every approved spoken language while retaining concise spoken answers.
- [ ] Re-run chat, translation-intent, and TravelDaddy tests.

## Milestone 9: Verification and deployment readiness

- [ ] Run `npm run lint`; require zero errors.
- [ ] Run `npm test`; require every test to pass.
- [ ] Run `npm run build`; require successful Prisma generation, TypeScript, page generation, and final optimization.
- [ ] Confirm build output includes `/api/avatar/transcription-token` and does not introduce a `prisma db push` command.
- [ ] Confirm no secret value appears in client bundles, logs, snapshots, or committed files.
- [ ] Verify Talk, Stop/edit/Send, automatic re-listening, End conversation, typed fallback, Copy, translate, Speak translation, reduced motion, and permission-denied flows in a real browser.
- [ ] Verify Chrome desktop, Safari/WebKit behavior, Pixel/Chrome mobile layout, and fallback selection.
- [ ] Verify the deprecated HeyGen endpoint is no longer called from the deployed UI.
- [ ] Update `AGENT_HARD_STOP_HERE.md` with final PASS/FAIL results and any remaining deployment variables.

## Acceptance criteria

- Judy faces the camera and shows subtle state-appropriate motion.
- Nothing speaks or requests the microphone before the traveler clicks **Talk with Judy**.
- One click begins a guided spoken conversation and all controls explain themselves.
- Live interim transcription is visible, Stop preserves editable text, and normal final speech auto-submits.
- Judy never listens while her own speech is playing.
- Listening resumes after every spoken response until End conversation.
- Browser speech recognition is preferred; Scribe v2 Realtime is used only as the supported fallback.
- No ElevenLabs API key or Hermes secret reaches the browser.
- Judy replies are captioned, copyable, translatable, and explicitly re-speakable in the selected language.
- Existing typed chat, browser TTS, portrait fallback, translation, RAG, Hermes/Gemini, and accessibility behavior remain functional.
