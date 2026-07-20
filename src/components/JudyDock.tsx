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
  ChevronUp,
  ChevronDown,
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
import { detectEmotion, type EmotionPreset } from "@/lib/avatar/emotion";
import { splitSentences, currentSentenceIndex } from "@/lib/avatar/sentenceSplit";

/** Bundled fallback used until an administrator activates an uploaded model. */
export const GLB_AVATAR_MODEL_URL = "/Judynoplip.glb";

interface ChatTranslation {
  original: string;
  translatedText: string;
  sourceLanguage: string | null;
  targetLanguage: string;
}

interface ChatMessage {
  role: "user" | "judy";
  text: string;
  translation?: ChatTranslation;
  /** Language of the displayed reply when known; audio may be localized separately. */
  replyLanguage?: string | null;
}

/* ── Component ────────────────────────────────────────────── */

interface JudyDockProps {
  tripContext?: any;
  userName?: string;
  userEmail?: string;
  avatarModelUrl?: string;
  /** When true, renders as a persistent sidebar/drawer instead of overlay. */
  docked?: boolean;
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
  "Hi, I'm Judy Pierre, your travel translator and guide. Ask me about your trip, say a phrase to translate, or ask what to do nearby. I'll listen after I finish speaking; tap Stop whenever you want to edit what I heard.";

function audioBlobFromBase64(audio: string, mimeType: string): Blob {
  const decoded = window.atob(audio);
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export default function JudyDock({
  tripContext,
  userName,
  userEmail,
  avatarModelUrl = GLB_AVATAR_MODEL_URL,
  docked = false,
}: JudyDockProps) {
  const [chatOpen, setChatOpen] = useState(docked);
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
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SPEECH_SYNTHESIS_STORAGE_KEY) === "true";
  });
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("loading");
  const [glbAvatarFailed, setGlbAvatarFailed] = useState(false);
  const [visemeCues, setVisemeCues] = useState<RhubarbCue[] | null>(null);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
  const talkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const speechFinishedRef = useRef<(() => void) | null>(null);
  /** Current emotion preset for the avatar, detected from the last reply. */
  const [emotion, setEmotion] = useState<EmotionPreset | null>(null);
  /** Current sentence index for the subtitle caption during speech. */
  const [currentCaption, setCurrentCaption] = useState<string | null>(null);
  const captionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Mobile dock expand/collapse state. */
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "judy",
      text: "Hey darling! I'm Judy Pierre, your purple rhino travel guide. Ask me anything about your trip — where to go, what to do, how to say it — and I'll steer you right!",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const userInitial = (userName || "You").trim().charAt(0).toUpperCase();

  // Deterministic onboarding intake
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

  // ── Caption timer management ──────────────────────────────────
  const startCaptionTimer = useCallback((text: string) => {
    if (captionTimerRef.current) clearInterval(captionTimerRef.current);
    const sentences = splitSentences(text);
    if (sentences.length === 0) return;
    const startTime = performance.now();
    setCurrentCaption(sentences[0]);
    captionTimerRef.current = setInterval(() => {
      const elapsed = (performance.now() - startTime) / 1000;
      const idx = currentSentenceIndex(sentences, elapsed);
      if (idx >= 0 && idx < sentences.length) {
        setCurrentCaption(sentences[idx]);
      }
    }, 200);
  }, []);

  const stopCaptionTimer = useCallback(() => {
    if (captionTimerRef.current) {
      clearInterval(captionTimerRef.current);
      captionTimerRef.current = null;
    }
    setCurrentCaption(null);
  }, []);

  useEffect(() => {
    return () => {
      if (captionTimerRef.current) clearInterval(captionTimerRef.current);
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
      stopCaptionTimer();
    }
  }, [stopCaptionTimer]);

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
        if (speechRequestRef.current === requestId) {
          setIsTalking(true);
          startCaptionTimer(text);
        }
      };
      const finish = () => {
        if (speechRequestRef.current !== requestId) return;
        setIsTalking(false);
        setVisemeCues(null);
        stopCaptionTimer();
        finishSpeechLifecycle();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsTalking(false);
      stopCaptionTimer();
      finishSpeechLifecycle();
    }
  }, [finishSpeechLifecycle, stopLocalSpeech, startCaptionTimer, stopCaptionTimer]);

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
        startCaptionTimer(text);
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
  }, [finishSpeechLifecycle, releaseLocalAudio, speakWithBrowser, stopLocalSpeech, startCaptionTimer]);

  const showEstimatedTalking = useCallback((text: string, onFinished?: () => void) => {
    stopLocalSpeech();
    speechFinishedRef.current = onFinished ?? null;
    if (talkingTimerRef.current) clearTimeout(talkingTimerRef.current);
    setIsTalking(true);
    startCaptionTimer(text);
    const duration = Math.min(Math.max(text.length * 55, 1200), 8000);
    talkingTimerRef.current = setTimeout(() => {
      talkingTimerRef.current = null;
      setIsTalking(false);
      stopCaptionTimer();
      finishSpeechLifecycle();
    }, duration);
  }, [finishSpeechLifecycle, stopLocalSpeech, startCaptionTimer, stopCaptionTimer]);

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

  // ── Streaming + buffered message send ─────────────────────────
  const sendMessage = useCallback(async (messageText?: string) => {
    const trimmed = (messageText ?? input).trim();
    if (!trimmed || isLoading) return;

    const history = messages.slice(-8).map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      text: message.text.slice(0, 800),
    }));

    const userMsg: ChatMessage = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    stopLocalSpeech();

    try {
      // Try streaming first (SSE), fall back to buffered JSON
      const res = await fetch("/api/avatar/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: trimmed,
          tripContext: tripContext || null,
          history,
        }),
      });

      // SSE streaming path
      if (res.headers.get("content-type")?.includes("text/event-stream") && res.body) {
        let fullReply = "";
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        // Add a placeholder message that we'll update as tokens arrive
        const judyMsgIndex = messages.length + 1; // +1 for the user msg we just added
        setMessages((prev) => [...prev, { role: "judy", text: "" }]);

        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? ""; // keep incomplete line in buffer
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.token) {
                fullReply += data.token;
                setMessages((prev) => {
                  const updated = [...prev];
                  if (updated.length > judyMsgIndex) {
                    updated[judyMsgIndex] = { ...updated[judyMsgIndex], text: fullReply };
                  }
                  return updated;
                });
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        const reply = fullReply || "Hmm, the trail went quiet for a moment. Try again, friend!";
        // Ensure final message is complete
        setMessages((prev) => {
          const updated = [...prev];
          if (updated.length > judyMsgIndex) {
            updated[judyMsgIndex] = { ...updated[judyMsgIndex], text: reply };
          }
          return updated;
        });

        // Detect emotion from the completed reply
        setEmotion(detectEmotion(reply));

        if (conversation.sessionActive) {
          dispatchConversation({ type: "REPLY_READY" });
        }
        const finishConversationSpeech = conversation.sessionActive
          ? () => dispatchConversation({ type: "SPEECH_FINISHED" })
          : undefined;

        if (speechEnabled || conversation.sessionActive) {
          void speakWithLipSync(reply, undefined, finishConversationSpeech);
        } else {
          showEstimatedTalking(reply, finishConversationSpeech);
        }
      } else {
        // Buffered JSON path (Hermes/Gemma or non-streaming Gemini)
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
          { role: "judy", text: reply, translation: replyTranslation, replyLanguage },
        ]);

        // Detect emotion from the reply
        setEmotion(detectEmotion(reply));

        if (conversation.sessionActive) {
          dispatchConversation({ type: "REPLY_READY" });
        }
        const finishConversationSpeech = conversation.sessionActive
          ? () => dispatchConversation({ type: "SPEECH_FINISHED" })
          : undefined;

        if (speechEnabled || conversation.sessionActive) {
          void speakWithLipSync(
            reply,
            replyLanguage ?? undefined,
            finishConversationSpeech
          );
        } else {
          showEstimatedTalking(reply, finishConversationSpeech);
        }
      }
    } catch {
      setIsTalking(false);
      setMessages((prev) => [
        ...prev,
        { role: "judy", text: "HAH! Looks like the signal's a bit fuzzy out here in the woods. Try again!" },
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
    messages,
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
    onEnd: () => {},
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

  const lastJudyMessage = [...messages].reverse().find((message) => message.role === "judy");

  // ── Render ────────────────────────────────────────────────────
  const wrapperClass = docked
    ? `judy-dock${mobileExpanded ? " judy-dock-expanded" : ""}`
    : "judy-wrapper";

  return (
    <div className={wrapperClass}>
      {/* Mobile dock header (collapsed bar when docked) */}
      {docked && (
        <button
          type="button"
          className="judy-dock-handle"
          onClick={() => setMobileExpanded((v) => !v)}
          aria-label={mobileExpanded ? "Collapse Judy" : "Expand Judy"}
        >
          <span className="judy-dock-handle-label">
            <Compass size={16} aria-hidden="true" />
            Judy Pierre
          </span>
          {mobileExpanded ? (
            <ChevronDown size={16} aria-hidden="true" />
          ) : (
            <ChevronUp size={16} aria-hidden="true" />
          )}
        </button>
      )}

      {/* Avatar canvas */}
      <div className={docked ? "judy-dock-avatar" : "canvas-wrapper"}>
        {!glbAvatarFailed && (
          <div className="judy-glb-avatar" role="img" aria-label="Judy Pierre, Judy's travel translator and guide">
            <AvatarStage
              modelUrl={avatarModelUrl}
              talking={isTalking}
              phase={conversation.phase}
              cues={visemeCues}
              emotion={emotion}
              onUnavailable={() => setGlbAvatarFailed(true)}
            />
          </div>
        )}
        {glbAvatarFailed && (
          <Image
            src="/avatars/robjudy.jpg"
            alt="Judy Pierre, Judy's travel translator and guide"
            fill
            sizes="(max-width: 768px) 100vw, 360px"
            priority
            className={`judy-static-avatar${isTalking ? " is-talking" : ""}`}
          />
        )}

        {/* Subtle pill caption — only when NOT docked (docked shows inline chat) */}
        {isTalking && currentCaption && !docked && (
          <div className="judy-speech-caption" aria-live="polite">
            {currentCaption}
          </div>
        )}

        {/* Subtle pill caption — docked mode, over the avatar area */}
        {isTalking && currentCaption && docked && (
          <div className="judy-speech-caption judy-speech-caption-docked" aria-live="polite">
            {currentCaption}
          </div>
        )}
      </div>

      {/* Conversation dock controls */}
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
        onSuggestion={(suggestion) => {
          if (suggestion === "translate") {
            setTranslateOpen(true);
            return;
          }
          setChatOpen(true);
          setInput(
            suggestion === "plan"
              ? "Help me plan my trip."
              : "What should I do nearby?"
          );
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
      />

      {/* Quick-action bar */}
      <div className="judy-quick-actions">
        <button
          className={`judy-quick-btn${translateOpen ? " active" : ""}`}
          onClick={() => setTranslateOpen((v) => !v)}
          title="Translate a phrase"
          aria-label="Translate a phrase"
          aria-pressed={translateOpen}
        >
          <Languages size={16} aria-hidden="true" />
        </button>
        <button
          className={`judy-quick-btn${experiencesOpen ? " active" : ""}`}
          onClick={() => setExperiencesOpen((v) => !v)}
          title="Browse experiences"
          aria-label="Browse experiences"
          aria-pressed={experiencesOpen}
        >
          <Compass size={16} aria-hidden="true" />
        </button>
        <button
          className={`judy-quick-btn${memoriesOpen ? " active" : ""}`}
          onClick={() => setMemoriesOpen((v) => !v)}
          title="Travel memories"
          aria-label="Travel memories"
          aria-pressed={memoriesOpen}
        >
          <ImageIcon size={16} aria-hidden="true" />
        </button>
        <button
          className={`judy-quick-btn${alertsOpen ? " active" : ""}`}
          onClick={() => setAlertsOpen((v) => !v)}
          title="Travel alerts"
          aria-label="Travel alerts"
          aria-pressed={alertsOpen}
        >
          <Bell size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Panels */}
      <ExperiencesPanel
        open={experiencesOpen}
        onClose={() => setExperiencesOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />
      <MemoriesPanel
        open={memoriesOpen}
        onClose={() => setMemoriesOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />
      <AlertsPanel
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        destinationName={
          (tripContext as { destinationName?: string } | null | undefined)?.destinationName ?? null
        }
      />

      {/* Translate panel */}
      {translateOpen && (
        <div className={`judy-chat-panel judy-translate-panel${docked ? " judy-panel-docked" : ""}`}>
          <div className="judy-chat-header">
            <div className="judy-chat-title">
              <Languages size={16} aria-hidden="true" />
              <span>Translate</span>
            </div>
            <button
              className="judy-chat-close"
              onClick={() => setTranslateOpen(false)}
              aria-label="Close translate panel"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="judy-translate-body">
            <textarea
              className="judy-translate-input"
              value={translateText}
              onChange={(e) => setTranslateText(e.target.value)}
              placeholder="Type a phrase to translate…"
              rows={3}
              maxLength={6000}
            />
            <div className="judy-translate-controls">
              <label className="judy-translate-lang-label">
                <span>from</span>
                <select
                  className="judy-translate-lang"
                  value={sourceLang}
                  onChange={(e) => setSourceLang(e.target.value)}
                >
                  <option value="Auto-detect">Auto-detect</option>
                  {TRANSLATE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <label className="judy-translate-lang-label">
                <span>to</span>
                <select
                  className="judy-translate-lang"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                >
                  {TRANSLATE_LANGUAGES.map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <button
                className="judy-send-btn judy-translate-go"
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
              <div className="judy-translate-hint" role="status" aria-live="polite">Asking Gemma…</div>
            )}
            {translation.status === "succeeded" && (
              <>
                <div className="judy-translate-result" role="status" aria-live="polite">
                  {extractHermesText(translation.result) || "No translation returned."}
                </div>
                <div className="judy-translate-swap-row">
                  <button
                    className="judy-translate-swap"
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
              <div className="judy-translate-error" role="alert">
                {translation.error || "Translation is unavailable right now."}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chat toggle (non-docked only) */}
      {!docked && !chatOpen && (
        <button
          className="judy-chat-toggle"
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

      {/* Chat panel / inline chat */}
      {(chatOpen || docked) && (
        <div className={`judy-chat-panel${docked ? " judy-chat-inline" : ""}`}>
          {!docked && (
            <div className="judy-chat-header">
              <div className="judy-chat-title">
                <div className="judy-avatar-dot" aria-hidden="true" />
                <span>{onboardingStatus === "pending" ? "Getting to know you" : "Judy Pierre"}</span>
              </div>
              <button
                className="judy-chat-close"
                onClick={() => setChatOpen(false)}
                aria-label="Close chat"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {onboardingStatus === "pending" ? (
            <OnboardingIntake
              userEmail={userEmail ?? ""}
              onDone={() => setOnboardingStatus("complete")}
            />
          ) : (
            <>
              <div className="judy-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
                {messages.map((msg, i) => (
                  <div key={i} className={`judy-msg ${msg.role === "user" ? "judy-msg-user" : "judy-msg-judy"}`}>
                    <span className="judy-msg-avatar" aria-hidden="true">
                      {msg.role === "judy" ? <Compass size={14} /> : userInitial}
                    </span>
                    <div className="judy-msg-bubble">
                      {msg.role === "judy" ? (
                        <ReplyActions
                          originalText={msg.text}
                          originalLanguage={msg.replyLanguage}
                          onSpeak={speakReplyAction}
                        />
                      ) : (
                        msg.text
                      )}
                      {msg.translation && (
                        <div className="judy-translation-inline">
                          <div className="judy-translation-lang-label">
                            {(msg.translation.sourceLanguage ?? "Detected")} → {msg.translation.targetLanguage}
                          </div>
                          <div className="judy-translation-original">{msg.translation.original}</div>
                          <div className="judy-translation-translated">{msg.translation.translatedText}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="judy-msg judy-msg-judy">
                    <span className="judy-msg-avatar" aria-hidden="true"><Compass size={14} /></span>
                    <div className="judy-msg-bubble judy-typing">
                      <span aria-hidden="true" /><span aria-hidden="true" /><span aria-hidden="true" />
                      <span className="sr-only">Judy Pierre is typing…</span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="judy-chat-input-bar">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask Judy Pierre anything..."
                  className="judy-chat-input"
                  disabled={isLoading}
                  aria-label="Message to Judy Pierre"
                />
                <button
                  className="judy-send-btn"
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
