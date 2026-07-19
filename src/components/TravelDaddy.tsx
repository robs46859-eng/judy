"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
  useReducer,
} from "react";
import {
  Send,
  Loader2,
  MessageCircle,
  X,
  Compass,
  Languages,
  ArrowLeftRight,
  Image as ImageIcon,
  Bell,
} from "lucide-react";
import { useHermesJob } from "@/lib/hermes/useHermesJob";
import { extractHermesText } from "@/lib/hermes/result";
import OnboardingIntake from "./OnboardingIntake";
import ExperiencesPanel from "./ExperiencesPanel";
import MemoriesPanel from "./MemoriesPanel";
import AlertsPanel from "./AlertsPanel";
import { SPEECH_SYNTHESIS_STORAGE_KEY } from "./VoiceSettings";
import AvatarStage from "./avatar/AvatarStage";
import ConversationDock from "./avatar/ConversationDock";
import ReplyActions from "./avatar/ReplyActions";
import { useBrowserRecognition } from "./avatar/useBrowserRecognition";
import { useScribeFallback } from "./avatar/useScribeFallback";
import {
  conversationReducer,
  INITIAL_CONVERSATION_STATE,
} from "./avatar/conversationMachine";
import type { RhubarbCue } from "@/lib/avatar/visemeTimeline";
import { normalizeVoiceLocale } from "@/lib/voice/catalog";

/** Bundled fallback used until an administrator activates an uploaded model. */
export const GLB_AVATAR_MODEL_URL = "/models/judyface.glb";

interface ChatTranslation {
  original: string;
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: string;
}

interface ChatMessage {
  role: "user" | "daddy";
  text: string;
  translation?: ChatTranslation;
  /** Language of the displayed reply when known; audio may be localized separately. */
  replyLanguage?: string | null;
}

/* ── Component ────────────────────────────────────────────── */

interface TravelDaddyProps {
  tripContext?: any;
  userName?: string;
  userEmail?: string;
  avatarModelUrl?: string;
}

interface LipSyncResponse {
  audio?: unknown;
  mimeType?: unknown;
  cues?: unknown;
  spokenText?: unknown;
  spokenLanguage?: unknown;
}

type OnboardingStatus = "loading" | "pending" | "complete";
type RecognitionBackend = "browser" | "scribe";

const TRANSLATE_LANGUAGES = [
  "Spanish", "French", "Portuguese", "Italian", "German",
  "Dutch", "Greek", "Thai", "Japanese", "Korean",
  "Mandarin Chinese", "Arabic", "Turkish", "English",
];

export const JUDY_CONVERSATION_WELCOME =
  "Hi, I’m Judy Pierre, your travel translator and guide. Ask me about your trip, say a phrase to translate, or ask what to do nearby. I’ll listen after I finish speaking; tap Stop whenever you want to edit what I heard.";

function audioBlobFromBase64(audio: string, mimeType: string): Blob {
  const decoded = window.atob(audio);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function TravelDaddy({
  tripContext,
  userName,
  userEmail,
  avatarModelUrl = GLB_AVATAR_MODEL_URL,
}: TravelDaddyProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [experiencesOpen, setExperiencesOpen] = useState(false);
  const [memoriesOpen, setMemoriesOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [translateText, setTranslateText] = useState("");
  const [sourceLang, setSourceLang] = useState("Auto-detect");
  const [targetLang, setTargetLang] = useState("Spanish");
  const translation = useHermesJob("translate");
  const [conversation, dispatchConversation] = useReducer(
    conversationReducer,
    INITIAL_CONVERSATION_STATE
  );
  const [spokenLanguage, setSpokenLanguage] = useState("en-US");
  const [recognitionBackend, setRecognitionBackend] = useState<RecognitionBackend>("browser");
  // Read once at mount — Dashboard unmounts/remounts TravelDaddy whenever the
  // person leaves and returns to this tab, so a change made in Settings is
  // picked up on the next mount without needing a live cross-component sync.
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SPEECH_SYNTHESIS_STORAGE_KEY) === "true";
  });
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("loading");
  // J7: rigged GLB is the primary local avatar now — robjudy.jpg is the
  // last-resort fallback for when the GLB fails to load/render (missing
  // file, malformed GLTF, no WebGL, ...), not the everyday default.
  const [glbAvatarFailed, setGlbAvatarFailed] = useState(false);
  // Stage 2 (accurate lip sync) — populated once /api/avatar/chat (or a
  // dedicated visemes endpoint) returns a Rhubarb cue timeline for the
  // current reply. Null means "no timeline yet" and AvatarMesh falls back
  // to the stage-1 approximate jaw movement driven by `isTalking`.
  const [visemeCues, setVisemeCues] = useState<RhubarbCue[] | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
  const talkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechFinishedRef = useRef<(() => void) | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "daddy",
      text: "Hey darling! I'm Judy Pierre, your purple rhino travel guide. Ask me anything about your trip — where to go, what to do, how to say it — and I'll steer you right!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userInitial = (userName || "You").trim().charAt(0).toUpperCase();

  // Deterministic onboarding intake (Swarm J3): if the signed-in user hasn't
  // completed it yet, open the chat panel automatically with the intake
  // flow instead of free-form chat. Any failure here fails OPEN to normal
  // chat — a broken preferences check must never trap the user.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/user/preferences");
        if (!res.ok) {
          if (!cancelled) setOnboardingStatus("complete");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        const savedSpokenLanguage = normalizeVoiceLocale(
          data?.spokenLanguage ?? data?.nativeLanguage
        );
        if (savedSpokenLanguage) setSpokenLanguage(savedSpokenLanguage);
        if (!data?.onboardingCompletedAt) {
          setOnboardingStatus("pending");
          setChatOpen(true);
        } else {
          setOnboardingStatus("complete");
        }
      } catch {
        if (!cancelled) setOnboardingStatus("complete");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const releaseLocalAudio = useCallback((updateUi = true) => {
    const audio = localAudioRef.current;
    if (audio) {
      audio.onplay = null;
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      localAudioRef.current = null;
    }
    if (localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current);
      localAudioUrlRef.current = null;
    }
    if (updateUi) {
      setIsTalking(false);
      setVisemeCues(null);
    }
  }, []);

  const finishSpeechLifecycle = useCallback(() => {
    const onFinished = speechFinishedRef.current;
    speechFinishedRef.current = null;
    onFinished?.();
  }, []);

  const stopLocalSpeech = useCallback(() => {
    speechRequestRef.current += 1;
    if (talkingTimerRef.current) {
      clearTimeout(talkingTimerRef.current);
      talkingTimerRef.current = null;
    }
    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }
    releaseLocalAudio();
    finishSpeechLifecycle();
  }, [finishSpeechLifecycle, releaseLocalAudio]);

  const speakWithBrowser = useCallback((
    text: string,
    language?: string,
    onFinished?: () => void
  ) => {
    stopLocalSpeech();
    speechFinishedRef.current = onFinished ?? null;
    if (typeof window === "undefined" || !window.speechSynthesis) {
      finishSpeechLifecycle();
      return;
    }
    const requestId = speechRequestRef.current;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      if (language) {
        utterance.lang = language;
        const normalized = language.toLowerCase();
        const baseLanguage = normalized.split("-")[0];
        const availableVoice = window.speechSynthesis
          .getVoices()
          .find((voice) => voice.lang.toLowerCase() === normalized)
          ?? window.speechSynthesis
            .getVoices()
            .find((voice) => voice.lang.toLowerCase().split("-")[0] === baseLanguage);
        if (availableVoice) utterance.voice = availableVoice;
      }
      utterance.onstart = () => {
        if (speechRequestRef.current === requestId) setIsTalking(true);
      };
      const finish = () => {
        if (speechRequestRef.current !== requestId) return;
        setIsTalking(false);
        setVisemeCues(null);
        finishSpeechLifecycle();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsTalking(false);
      finishSpeechLifecycle();
    }
  }, [finishSpeechLifecycle, stopLocalSpeech]);

  /**
   * Play the exact WAV Rhubarb analyzed. Starting the cue clock from the
   * audio element's `play` event keeps the visible mouth and audible voice
   * on the same timeline. Browser speech remains the fail-open fallback.
   */
  const speakWithLipSync = useCallback(async (
    text: string,
    language?: string,
    onFinished?: () => void
  ) => {
    stopLocalSpeech();
    speechFinishedRef.current = onFinished ?? null;
    const requestId = speechRequestRef.current;
    try {
      const response = await fetch("/api/avatar/lipsync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...(language ? { language } : {}) }),
      });
      if (!response.ok) throw new Error("Lip sync unavailable");

      const payload = (await response.json()) as LipSyncResponse;
      if (
        speechRequestRef.current !== requestId ||
        typeof payload.audio !== "string" ||
        typeof payload.mimeType !== "string"
      ) {
        if (speechRequestRef.current === requestId) throw new Error("Invalid lip sync response");
        return;
      }

      const cues = Array.isArray(payload.cues) ? (payload.cues as RhubarbCue[]) : [];
      const url = URL.createObjectURL(audioBlobFromBase64(payload.audio, payload.mimeType));
      const audio = new Audio(url);
      localAudioRef.current = audio;
      localAudioUrlRef.current = url;

      const finish = () => {
        if (localAudioRef.current !== audio) return;
        releaseLocalAudio();
        finishSpeechLifecycle();
      };
      audio.onplay = () => {
        if (speechRequestRef.current !== requestId || localAudioRef.current !== audio) return;
        setVisemeCues(cues.length > 0 ? cues : null);
        setIsTalking(true);
      };
      audio.onended = finish;
      const spokenText = typeof payload.spokenText === "string" ? payload.spokenText : text;
      const spokenLanguage = typeof payload.spokenLanguage === "string" ? payload.spokenLanguage : language;
      audio.onerror = () => {
        if (speechRequestRef.current !== requestId || localAudioRef.current !== audio) return;
        releaseLocalAudio();
        speechFinishedRef.current = null;
        speakWithBrowser(spokenText, spokenLanguage, onFinished);
      };
      await audio.play();
    } catch {
      if (speechRequestRef.current === requestId) {
        speechFinishedRef.current = null;
        speakWithBrowser(text, language, onFinished);
      }
    }
  }, [finishSpeechLifecycle, releaseLocalAudio, speakWithBrowser, stopLocalSpeech]);

  const showEstimatedTalking = useCallback((text: string, onFinished?: () => void) => {
    stopLocalSpeech();
    speechFinishedRef.current = onFinished ?? null;
    if (talkingTimerRef.current) clearTimeout(talkingTimerRef.current);
    setIsTalking(true);
    const duration = Math.min(Math.max(text.length * 55, 1200), 8000);
    talkingTimerRef.current = setTimeout(() => {
      talkingTimerRef.current = null;
      setIsTalking(false);
      finishSpeechLifecycle();
    }, duration);
  }, [finishSpeechLifecycle, stopLocalSpeech]);

  useEffect(() => {
    return () => {
      speechRequestRef.current += 1;
      if (talkingTimerRef.current) clearTimeout(talkingTimerRef.current);
      window.speechSynthesis?.cancel();
      releaseLocalAudio(false);
    };
  }, [releaseLocalAudio]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    stopLocalSpeech();

    try {
      const res = await fetch("/api/avatar/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          tripContext: tripContext || null,
        }),
      });
      const data = await res.json();
      const reply = data.reply || "Hmm, the trail went quiet for a moment. Try again, friend!";
      const replyTranslation: ChatTranslation | undefined = data.translation
        ? {
            original: data.translation.original,
            translatedText: data.translation.translatedText,
            sourceLanguage: data.translation.sourceLanguage ?? null,
            targetLanguage: data.translation.targetLanguage,
          }
        : undefined;
      const replyLanguage = replyTranslation?.targetLanguage ?? null;

      setMessages((prev) => [
        ...prev,
        { role: "daddy", text: reply, translation: replyTranslation, replyLanguage },
      ]);
      if (conversation.sessionActive) {
        dispatchConversation({ type: "REPLY_READY" });
      }
      const finishConversationSpeech = conversation.sessionActive
        ? () => dispatchConversation({ type: "SPEECH_FINISHED" })
        : undefined;

      // The local GLB plays the exact ElevenLabs WAV that Rhubarb analyzed,
      // with browser TTS as a best-effort fallback when server speech is unavailable.
      if (speechEnabled || conversation.sessionActive) {
        void speakWithLipSync(
          reply,
          replyLanguage ?? undefined,
          finishConversationSpeech
        );
      } else {
        // Keep the existing visual/caption response when audio is disabled.
        // This is an intentionally approximate animation, not lip sync.
        showEstimatedTalking(reply, finishConversationSpeech);
      }
    } catch {
      setIsTalking(false);
      setMessages((prev) => [
        ...prev,
        { role: "daddy", text: "HAH! Looks like the signal's a bit fuzzy out here in the woods. Try again!" },
      ]);
      if (conversation.sessionActive) {
        dispatchConversation({
          type: "FAIL",
          message: "Judy could not answer just now. You can resume listening or type instead.",
        });
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isLoading,
    tripContext,
    conversation.sessionActive,
    speechEnabled,
    showEstimatedTalking,
    speakWithLipSync,
    stopLocalSpeech,
  ]);

  const handleRecognizedFinal = useCallback((text: string) => {
    dispatchConversation({ type: "COMMIT", text });
    void sendMessage(text);
  }, [sendMessage]);

  const scribeFallback = useScribeFallback({
    languageCode: spokenLanguage,
    onInterim: (text) => dispatchConversation({ type: "INTERIM", text }),
    onFinal: handleRecognizedFinal,
    onFailure: (message) => dispatchConversation({ type: "FAIL", message }),
  });

  const browserRecognition = useBrowserRecognition({
    language: spokenLanguage,
    onInterim: (text) => dispatchConversation({ type: "INTERIM", text }),
    onFinal: handleRecognizedFinal,
    onFailure: (reason, message) => {
      if (reason === "unsupported" || reason === "service-failed") {
        setRecognitionBackend("scribe");
        return;
      }
      dispatchConversation({ type: "FAIL", message });
    },
    onEnd: () => {
      // The reducer phase controls whether another turn starts. A final result
      // moves to thinking; Stop moves to editing; neither should auto-restart here.
    },
  });
  const {
    start: startBrowserRecognition,
    stop: stopBrowserRecognition,
    abort: abortBrowserRecognition,
  } = browserRecognition;
  const {
    start: startScribeFallback,
    stop: stopScribeFallback,
    abort: abortScribeFallback,
  } = scribeFallback;

  useEffect(() => {
    if (conversation.phase === "listening" && document.visibilityState !== "hidden") {
      if (recognitionBackend === "browser") {
        startBrowserRecognition();
      } else {
        void startScribeFallback();
      }
    } else {
      abortBrowserRecognition();
      abortScribeFallback();
    }
  }, [
    conversation.phase,
    recognitionBackend,
    startBrowserRecognition,
    abortBrowserRecognition,
    startScribeFallback,
    abortScribeFallback,
  ]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && conversation.phase === "listening") {
        abortBrowserRecognition();
        abortScribeFallback();
        dispatchConversation({ type: "PAUSE" });
      } else if (document.visibilityState === "visible" && conversation.phase === "paused") {
        dispatchConversation({ type: "RESUME" });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [conversation.phase, abortBrowserRecognition, abortScribeFallback]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const speakReplyAction = useCallback((text: string, language?: string) => {
    const phaseAtStart = conversation.phase;
    const resumeListening = conversation.sessionActive && phaseAtStart === "listening";
    const finishCurrentReply = conversation.sessionActive && phaseAtStart === "speaking";

    abortBrowserRecognition();
    abortScribeFallback();
    // A deliberate Speak translation click replaces any current line without
    // firing that replaced line's completion callback in the middle of playback.
    speechFinishedRef.current = null;
    stopLocalSpeech();
    if (resumeListening) dispatchConversation({ type: "PAUSE" });

    return new Promise<void>((resolve) => {
      void speakWithLipSync(text, language, () => {
        if (resumeListening) {
          dispatchConversation({ type: "RESUME" });
        } else if (finishCurrentReply) {
          dispatchConversation({ type: "SPEECH_FINISHED" });
        }
        resolve();
      });
    });
  }, [
    conversation.phase,
    conversation.sessionActive,
    abortBrowserRecognition,
    abortScribeFallback,
    speakWithLipSync,
    stopLocalSpeech,
  ]);

  const runTranslate = useCallback(
    (text: string, from: string, to: string) => {
      translation.submit({
        input: text,
        target_language: to,
        ...(from !== "Auto-detect" ? { source_language: from } : {}),
      });
    },
    [translation]
  );

  // Swap languages (Swarm J4): swaps the source/target selectors and resubmits
  // the last translated text through in the opposite direction. "Auto-detect"
  // has no concrete language to swap into, so it falls back to English as the
  // new target — the person can always change it again before resubmitting.
  const handleSwap = useCallback(() => {
    const translatedText = extractHermesText(translation.result);
    if (!translatedText) return;
    const newSource = targetLang;
    const newTarget = sourceLang === "Auto-detect" ? "English" : sourceLang;
    setSourceLang(newSource);
    setTargetLang(newTarget);
    setTranslateText(translatedText);
    runTranslate(translatedText, newSource, newTarget);
  }, [translation.result, sourceLang, targetLang, runTranslate]);

  const lastDaddyMessage = [...messages].reverse().find((message) => message.role === "daddy");
  const hasDaddyReply = Boolean(lastDaddyMessage);

  return (
    <div className="travel-daddy-wrapper">
      {/* The local rigged Judy is the primary avatar. */}
      <div className="canvas-wrapper">
        {/* J7: rigged GLB is the primary local avatar (jaw/viseme-driven
            "talking" motion); the flat portrait is only the last-resort
            fallback if the 3D model can't load or render at all. */}
        {!glbAvatarFailed && (
          <div className="td-glb-avatar" role="img" aria-label="Judy Pierre, Judy's travel translator and guide">
            <AvatarStage
              modelUrl={avatarModelUrl}
              talking={isTalking}
              phase={conversation.phase}
              cues={visemeCues}
              onUnavailable={() => setGlbAvatarFailed(true)}
            />
          </div>
        )}
        {glbAvatarFailed && (
          <Image
            src="/avatars/robjudy.jpg"
            alt="Judy Pierre, Judy's travel translator and guide"
            fill
            sizes="(max-width: 768px) 100vw, 65vw"
            priority
            className={`td-static-avatar${isTalking ? " is-talking" : ""}`}
          />
        )}

        {/* Caption (Swarm J6): the chat panel is the full transcript, but the
            person may have it collapsed while the avatar is talking — show a
            live caption of the current line so audio is never the only way
            to get the reply. */}
        {isTalking && hasDaddyReply && lastDaddyMessage && (
          <div className="td-caption" aria-live="polite">
            <ReplyActions
              originalText={
                lastDaddyMessage.translation?.translatedText || lastDaddyMessage.text
              }
              originalLanguage={lastDaddyMessage.replyLanguage}
              onSpeak={speakReplyAction}
            />
          </div>
        )}

        <ConversationDock
          state={conversation}
          onStart={() => {
            dispatchConversation({ type: "START" });
            abortBrowserRecognition();
            abortScribeFallback();
            setSpeechEnabled(true);
            if (typeof window !== "undefined") {
              window.localStorage.setItem(SPEECH_SYNTHESIS_STORAGE_KEY, "true");
            }
            void speakWithLipSync(
              JUDY_CONVERSATION_WELCOME,
              spokenLanguage,
              () => dispatchConversation({ type: "WELCOME_FINISHED" })
            );
          }}
          onStopListening={() => {
            stopBrowserRecognition();
            stopScribeFallback();
            dispatchConversation({ type: "STOP_LISTENING" });
          }}
          onTranscriptChange={(text) => dispatchConversation({ type: "EDIT", text })}
          onSubmit={() => {
            const correctedTranscript = conversation.finalTranscript.trim();
            if (!correctedTranscript) return;
            dispatchConversation({ type: "SUBMIT" });
            void sendMessage(correctedTranscript);
          }}
          onResume={() => {
            if (recognitionBackend === "browser") {
              startBrowserRecognition();
            } else {
              void startScribeFallback();
            }
            dispatchConversation({ type: "RESUME" });
          }}
          onEnd={() => {
            abortBrowserRecognition();
            abortScribeFallback();
            stopLocalSpeech();
            dispatchConversation({ type: "END" });
          }}
          onTypeInstead={() => {
            setChatOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }}
        />
      </div>

      {/* Translate toggle button (gay-travel translation avatar) */}
      <button
        className={`td-translate-toggle${translateOpen ? " active" : ""}`}
        onClick={() => setTranslateOpen((v) => !v)}
        title="Translate a phrase"
        aria-label="Translate a phrase"
        aria-pressed={translateOpen}
      >
        <Languages size={18} aria-hidden="true" />
      </button>

      {/* Experiences quick-action — curated gay-tailored experiences */}
      <button
        className={`td-experiences-toggle${experiencesOpen ? " active" : ""}`}
        onClick={() => setExperiencesOpen((v) => !v)}
        title="Browse experiences"
        aria-label="Browse experiences"
        aria-pressed={experiencesOpen}
      >
        <Compass size={18} aria-hidden="true" />
      </button>
      <ExperiencesPanel
        open={experiencesOpen}
        onClose={() => setExperiencesOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />

      {/* Memories quick-action — AI-captioned travel albums */}
      <button
        className={`td-memories-toggle${memoriesOpen ? " active" : ""}`}
        onClick={() => setMemoriesOpen((v) => !v)}
        title="Travel memories"
        aria-label="Travel memories"
        aria-pressed={memoriesOpen}
      >
        <ImageIcon size={18} aria-hidden="true" />
      </button>
      <MemoriesPanel
        open={memoriesOpen}
        onClose={() => setMemoriesOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />

      {/* Travel alerts quick-action */}
      <button
        className={`td-alerts-toggle${alertsOpen ? " active" : ""}`}
        onClick={() => setAlertsOpen((v) => !v)}
        title="Travel alerts"
        aria-label="Travel alerts"
        aria-pressed={alertsOpen}
      >
        <Bell size={18} aria-hidden="true" />
      </button>
      <AlertsPanel
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />

      {/* Translate panel — powered by Gemma via Hermes */}
      {translateOpen && (
        <div className="td-chat-panel td-translate-panel">
          <div className="td-chat-header">
            <div className="td-chat-title">
              <Languages size={16} aria-hidden="true" />
              <span>Translate</span>
            </div>
            <button
              className="td-chat-close"
              onClick={() => setTranslateOpen(false)}
              aria-label="Close translate panel"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="td-translate-body">
            <textarea
              className="td-translate-input"
              value={translateText}
              onChange={(e) => setTranslateText(e.target.value)}
              placeholder="Type a phrase to translate…"
              rows={3}
              maxLength={6000}
            />
            <div className="td-translate-controls">
              <label className="td-translate-lang-label">
                <span>from</span>
                <select
                  className="td-translate-lang"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                >
                  <option value="Auto-detect">Auto-detect</option>
                  {TRANSLATE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <label className="td-translate-lang-label">
                <span>to</span>
                <select
                  className="td-translate-lang"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                >
                  {TRANSLATE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <button
                className="td-send-btn td-translate-go"
                onClick={() => runTranslate(translateText.trim(), sourceLang, targetLang)}
                disabled={translation.isBusy || !translateText.trim()}
                title="Translate"
                aria-label="Translate"
              >
                {translation.isBusy ? (
                  <Loader2 size={16} className="spinner" aria-hidden="true" />
                ) : (
                  <Send size={16} aria-hidden="true" />
                )}
              </button>
            </div>

            {translation.isBusy && (
              <div className="td-translate-hint" role="status" aria-live="polite">Asking Gemma…</div>
            )}
            {translation.status === "succeeded" && (
              <>
                <div className="td-translate-result" role="status" aria-live="polite">
                  {extractHermesText(translation.result) || "No translation returned."}
                </div>
                <div className="td-translate-swap-row">
                  <button
                    className="td-translate-swap"
                    onClick={handleSwap}
                    disabled={translation.isBusy || !extractHermesText(translation.result)}
                    title="Swap languages and translate back"
                  >
                    <ArrowLeftRight size={14} aria-hidden="true" /> Swap languages
                  </button>
                </div>
              </>
            )}
            {translation.status === "failed" && (
              <div className="td-translate-error" role="alert">
                {translation.error || "Translation is unavailable right now."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat toggle button */}
      {!chatOpen && (
        <button
          className="td-chat-toggle"
          onClick={() => {
            setChatOpen(true);
            setTimeout(() => inputRef.current?.focus(), 100);
          }}
          title="Chat with Judy Pierre"
        >
          <MessageCircle size={20} aria-hidden="true" />
          <span>Ask Judy Pierre</span>
        </button>
      )}

      {/* Chat panel — runs the deterministic onboarding intake first (if not
          yet completed), then falls through to normal free-form chat. The
          close button always works so the panel is never a trap. */}
      {chatOpen && (
        <div className="td-chat-panel">
          <div className="td-chat-header">
            <div className="td-chat-title">
              <div className="td-avatar-dot" aria-hidden="true" />
              <span>{onboardingStatus === "pending" ? "Getting to know you" : "Judy Pierre"}</span>
            </div>
            <button
              className="td-chat-close"
              onClick={() => setChatOpen(false)}
              aria-label="Close chat"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {onboardingStatus === "pending" ? (
            <OnboardingIntake
              userEmail={userEmail ?? ""}
              onDone={() => setOnboardingStatus("complete")}
            />
          ) : (
            <>
              <div className="td-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
                {messages.map((msg, i) => (
                  <div key={i} className={`td-msg ${msg.role === "user" ? "td-msg-user" : "td-msg-daddy"}`}>
                    <span className="td-msg-avatar" aria-hidden="true">
                      {msg.role === "daddy" ? <Compass size={14} /> : userInitial}
                    </span>
                    <div className="td-msg-bubble">
                      {msg.role === "daddy" ? (
                        <ReplyActions
                          originalText={msg.text}
                          originalLanguage={msg.replyLanguage}
                          onSpeak={speakReplyAction}
                        />
                      ) : (
                        msg.text
                      )}
                      {msg.translation && (
                        <div className="td-translation-inline">
                          <div className="td-translation-lang-label">
                            {(msg.translation.sourceLanguage ?? "Detected")} → {msg.translation.targetLanguage}
                          </div>
                          <div className="td-translation-original">{msg.translation.original}</div>
                          <div className="td-translation-translated">{msg.translation.translatedText}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="td-msg td-msg-daddy">
                    <span className="td-msg-avatar" aria-hidden="true"><Compass size={14} /></span>
                    <div className="td-msg-bubble td-typing">
                      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
                      <span className="sr-only">Judy Pierre is typing…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="td-chat-input-bar">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Judy Pierre anything..."
                  className="td-chat-input"
                  disabled={isLoading}
                  aria-label="Message to Judy Pierre"
                />
                <button
                  className="td-send-btn"
                  onClick={() => void sendMessage()}
                  disabled={isLoading || !input.trim()}
                  title="Send message"
                  aria-label="Send message"
                >
                  {isLoading ? <Loader2 size={18} className="spinner" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
