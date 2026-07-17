"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  Send,
  Loader2,
  MessageCircle,
  X,
  Compass,
  Languages,
  Video,
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  ArrowLeftRight,
} from "lucide-react";
import { useHermesJob } from "@/lib/hermes/useHermesJob";
import { extractHermesText } from "@/lib/hermes/result";
import OnboardingIntake from "./OnboardingIntake";
import { SPEECH_SYNTHESIS_STORAGE_KEY } from "./VoiceSettings";
import AvatarStage from "./avatar/AvatarStage";
import VoiceInputButton from "./avatar/VoiceInputButton";
import type { RhubarbCue } from "@/lib/avatar/visemeTimeline";

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
}

/* ── Component ────────────────────────────────────────────── */

interface TravelDaddyProps {
  tripContext?: any;
  userName?: string;
  userEmail?: string;
  avatarModelUrl?: string;
}

interface LiveAvatarSession {
  sessionId: string;
}

interface LipSyncResponse {
  audio?: unknown;
  mimeType?: unknown;
  cues?: unknown;
}

type OnboardingStatus = "loading" | "pending" | "complete";

const TRANSLATE_LANGUAGES = [
  "Spanish", "French", "Portuguese", "Italian", "German",
  "Dutch", "Greek", "Thai", "Japanese", "Korean",
  "Mandarin Chinese", "Arabic", "Turkish", "English",
];

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
  const [translateText, setTranslateText] = useState("");
  const [sourceLang, setSourceLang] = useState("Auto-detect");
  const [targetLang, setTargetLang] = useState("Spanish");
  const translation = useHermesJob("translate");
  const [liveSession, setLiveSession] = useState<LiveAvatarSession | null>(null);
  // J5: the live HeyGen session never starts on its own — the person has to
  // click "Go live" first. `liveOptIn` is the gate; the effect below only
  // does anything once it flips true, and flipping it back to false is what
  // triggers the effect's cleanup (disconnect + /api/avatar/stop).
  const [liveOptIn, setLiveOptIn] = useState(false);
  const [muted, setMuted] = useState(false);
  // Read once at mount — Dashboard unmounts/remounts TravelDaddy whenever the
  // person leaves and returns to this tab, so a change made in Settings is
  // picked up on the next mount without needing a live cross-component sync.
  const [speechEnabled] = useState<boolean>(() => {
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);
  const mutedRef = useRef(false);
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const localAudioUrlRef = useRef<string | null>(null);
  const speechRequestRef = useRef(0);
  const talkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "daddy",
      text: "Hey there, traveler! I'm Travel Daddy — your trusty woodsman guide. Ask me anything about your trip and I'll steer you right! HAH!",
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

  // Keep newly-attached audio elements in sync with the Mute control.
  useEffect(() => {
    mutedRef.current = muted;
    audioContainerRef.current
      ?.querySelectorAll("audio")
      .forEach((el) => {
        el.muted = muted;
      });
  }, [muted]);

  // Try to start a HeyGen interactive avatar session — only once the user has
  // explicitly opted in (Swarm J5). Falls back to the static portrait when
  // unavailable (no key, quota, network, ...) or whenever the user stops it.
  useEffect(() => {
    if (!liveOptIn) return;

    let cancelled = false;
    let sessionId: string | null = null;

    const startLiveAvatar = async () => {
      try {
        const res = await fetch("/api/avatar/session", { method: "POST" });
        if (!res.ok) return; // 501 = not configured → 3D model
        const data = await res.json();
        if (cancelled || !data.sessionId || !data.url || !data.accessToken) return;
        sessionId = data.sessionId;

        const { Room, RoomEvent, Track } = await import("livekit-client");
        const room = new Room({ adaptiveStream: true });
        roomRef.current = room;

        room.on(RoomEvent.TrackSubscribed, (track: import("livekit-client").RemoteTrack) => {
          if (cancelled) return;
          if (track.kind === Track.Kind.Video && videoRef.current) {
            track.attach(videoRef.current);
          } else if (track.kind === Track.Kind.Audio && audioContainerRef.current) {
            const el = track.attach();
            el.muted = mutedRef.current;
            audioContainerRef.current.appendChild(el);
          }
        });

        await room.connect(data.url, data.accessToken);
        if (cancelled) {
          room.disconnect();
          return;
        }
        setLiveSession({ sessionId: data.sessionId });
      } catch {
        // Any failure → keep the 3D model silently.
      }
    };

    startLiveAvatar();

    return () => {
      cancelled = true;
      try {
        roomRef.current?.disconnect();
      } catch {
        /* noop */
      }
      if (sessionId) {
        fetch("/api/avatar/stop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [liveOptIn]);

  const stopLiveSession = useCallback(() => {
    // Flipping liveOptIn off triggers the effect's own cleanup (disconnect +
    // /api/avatar/stop); resetting liveSession here just gives instant visual
    // feedback (the static portrait) without waiting on that async teardown.
    setLiveOptIn(false);
    setLiveSession(null);
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
  }, [releaseLocalAudio]);

  const speakWithBrowser = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    stopLocalSpeech();
    const requestId = speechRequestRef.current;
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onstart = () => {
        if (speechRequestRef.current === requestId) setIsTalking(true);
      };
      const finish = () => {
        if (speechRequestRef.current !== requestId) return;
        setIsTalking(false);
        setVisemeCues(null);
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsTalking(false);
    }
  }, [stopLocalSpeech]);

  /**
   * Play the exact WAV Rhubarb analyzed. Starting the cue clock from the
   * audio element's `play` event keeps the visible mouth and audible voice
   * on the same timeline. Browser speech remains the fail-open fallback.
   */
  const speakWithLipSync = useCallback(async (text: string, language?: string) => {
    stopLocalSpeech();
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
      };
      audio.onplay = () => {
        if (speechRequestRef.current !== requestId || localAudioRef.current !== audio) return;
        setVisemeCues(cues.length > 0 ? cues : null);
        setIsTalking(true);
      };
      audio.onended = finish;
      audio.onerror = () => {
        if (speechRequestRef.current !== requestId || localAudioRef.current !== audio) return;
        releaseLocalAudio();
        speakWithBrowser(text);
      };
      await audio.play();
    } catch {
      if (speechRequestRef.current === requestId) speakWithBrowser(text);
    }
  }, [releaseLocalAudio, speakWithBrowser, stopLocalSpeech]);

  const showEstimatedTalking = useCallback((text: string) => {
    if (talkingTimerRef.current) clearTimeout(talkingTimerRef.current);
    setIsTalking(true);
    const duration = Math.min(Math.max(text.length * 55, 1200), 8000);
    talkingTimerRef.current = setTimeout(() => {
      talkingTimerRef.current = null;
      setIsTalking(false);
    }, duration);
  }, []);

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

  const handleReplay = useCallback(() => {
    const lastDaddyMsg = [...messages].reverse().find((m) => m.role === "daddy");
    if (!lastDaddyMsg) return;
    const textToSpeak = lastDaddyMsg.translation?.translatedText || lastDaddyMsg.text;
    if (liveSession) {
      showEstimatedTalking(textToSpeak);
      fetch("/api/avatar/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: liveSession.sessionId, text: textToSpeak }),
      }).catch(() => {});
    } else if (speechEnabled) {
      void speakWithLipSync(textToSpeak);
    }
  }, [messages, liveSession, speechEnabled, showEstimatedTalking, speakWithLipSync]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
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
      const spokenText = replyTranslation?.translatedText || reply;

      setMessages((prev) => [...prev, { role: "daddy", text: reply, translation: replyTranslation }]);

      // Live HeyGen owns its own stream. The local GLB instead plays the
      // exact ElevenLabs WAV that Rhubarb analyzed, with browser TTS as a
      // best-effort fallback when server speech is unavailable.
      if (liveSession) {
        showEstimatedTalking(spokenText);
        fetch("/api/avatar/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: liveSession.sessionId, text: spokenText }),
        }).catch(() => {});
      } else if (speechEnabled) {
        void speakWithLipSync(spokenText);
      } else {
        // Keep the existing visual/caption response when audio is disabled.
        // This is an intentionally approximate animation, not lip sync.
        showEstimatedTalking(spokenText);
      }
    } catch {
      setIsTalking(false);
      setMessages((prev) => [
        ...prev,
        { role: "daddy", text: "HAH! Looks like the signal's a bit fuzzy out here in the woods. Try again!" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    input,
    isLoading,
    tripContext,
    liveSession,
    speechEnabled,
    showEstimatedTalking,
    speakWithLipSync,
    stopLocalSpeech,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

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

  const hasDaddyReply = messages.some((m) => m.role === "daddy");

  return (
    <div className="travel-daddy-wrapper">
      {/* Avatar: live HeyGen stream when opted in, approved portrait otherwise */}
      <div className="canvas-wrapper">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            display: liveSession ? "block" : "none",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            borderRadius: "inherit",
          }}
        />
        <div ref={audioContainerRef} style={{ display: "none" }} />
        {/* J7: rigged GLB is the primary local avatar (jaw/viseme-driven
            "talking" motion); the flat portrait is only the last-resort
            fallback if the 3D model can't load or render at all. */}
        {!liveSession && !glbAvatarFailed && (
          <div className="td-glb-avatar" role="img" aria-label="Travel Daddy, Judy's travel translator and guide">
            <AvatarStage
              modelUrl={avatarModelUrl}
              talking={isTalking}
              cues={visemeCues}
              onUnavailable={() => setGlbAvatarFailed(true)}
            />
          </div>
        )}
        {!liveSession && glbAvatarFailed && (
          <Image
            src="/avatars/robjudy.jpg"
            alt="Travel Daddy, Judy's travel translator and guide"
            fill
            sizes="(max-width: 768px) 100vw, 65vw"
            priority
            className={`td-static-avatar${isTalking ? " is-talking" : ""}`}
          />
        )}

        {/* Live-session controls (Swarm J5): opt-in gate + Mute/Stop/Replay */}
        <div className="td-avatar-controls">
          <button
            className="td-avatar-control-btn"
            onClick={handleReplay}
            disabled={!hasDaddyReply || (!liveSession && !speechEnabled)}
            title="Replay last reply"
            aria-label="Replay last reply"
          >
            <RotateCcw size={16} aria-hidden="true" />
          </button>
          {!liveOptIn ? (
            <button
              className="td-avatar-control-btn td-live-btn"
              onClick={() => setLiveOptIn(true)}
              title="Start the live avatar"
            >
              <Video size={16} aria-hidden="true" /> <span>Go live</span>
            </button>
          ) : (
            <>
              <button
                className="td-avatar-control-btn"
                onClick={() => setMuted((m) => !m)}
                title={muted ? "Unmute" : "Mute"}
                aria-label={muted ? "Unmute live avatar" : "Mute live avatar"}
                aria-pressed={muted}
              >
                {muted ? <VolumeX size={16} aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
              </button>
              <button
                className="td-avatar-control-btn"
                onClick={stopLiveSession}
                title="Stop live avatar"
                aria-label="Stop live avatar"
              >
                <Square size={16} aria-hidden="true" />
              </button>
            </>
          )}
        </div>

        {/* Caption (Swarm J6): the chat panel is the full transcript, but the
            person may have it collapsed while the avatar is talking — show a
            live caption of the current line so audio is never the only way
            to get the reply. */}
        {isTalking && hasDaddyReply && (
          <div className="td-caption" role="status" aria-live="polite">
            {(() => {
              const lastDaddyMsg = [...messages].reverse().find((m) => m.role === "daddy");
              return lastDaddyMsg?.translation?.translatedText || lastDaddyMsg?.text || "";
            })()}
          </div>
        )}
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
          title="Chat with Travel Daddy"
        >
          <MessageCircle size={20} aria-hidden="true" />
          <span>Ask Travel Daddy</span>
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
              <span>{onboardingStatus === "pending" ? "Getting to know you" : "Travel Daddy"}</span>
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
                      {msg.text}
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
                      <span className="sr-only">Travel Daddy is typing…</span>
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
                  placeholder="Ask Travel Daddy anything..."
                  className="td-chat-input"
                  disabled={isLoading}
                  aria-label="Message to Travel Daddy"
                />
                <VoiceInputButton
                  disabled={isLoading}
                  onTranscript={(transcript) => {
                    setInput((current) => `${current}${current.trim() ? " " : ""}${transcript}`);
                    inputRef.current?.focus();
                  }}
                />
                <button
                  className="td-send-btn"
                  onClick={sendMessage}
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
