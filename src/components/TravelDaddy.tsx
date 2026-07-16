"use client";

import Image from "next/image";
import {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Send, Loader2, MessageCircle, X, Compass, Languages } from "lucide-react";
import { useHermesJob } from "@/lib/hermes/useHermesJob";
import { extractHermesText } from "@/lib/hermes/result";
import OnboardingIntake from "./OnboardingIntake";

interface ChatMessage {
  role: "user" | "daddy";
  text: string;
}

/* ── Component ────────────────────────────────────────────── */

interface TravelDaddyProps {
  tripContext?: any;
  userName?: string;
  userEmail?: string;
}

interface LiveAvatarSession {
  sessionId: string;
}

type OnboardingStatus = "loading" | "pending" | "complete";

export default function TravelDaddy({ tripContext, userName, userEmail }: TravelDaddyProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateText, setTranslateText] = useState("");
  const [targetLang, setTargetLang] = useState("Spanish");
  const translation = useHermesJob("translate");
  const [liveSession, setLiveSession] = useState<LiveAvatarSession | null>(null);
  const [onboardingStatus, setOnboardingStatus] = useState<OnboardingStatus>("loading");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);

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

  // Try to start a HeyGen interactive avatar session; fall back to the
  // local 3D model when unavailable (no key, quota, network, ...).
  useEffect(() => {
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
            audioContainerRef.current.appendChild(track.attach());
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
  }, []);

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

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", text: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    setIsTalking(true);

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

      // Talking duration paced to reply length (human reading speed)
      const talkDuration = Math.min(reply.length * 55, 8000);
      setTimeout(() => setIsTalking(false), talkDuration);

      // If the live HeyGen avatar is active, have it speak the reply.
      if (liveSession) {
        fetch("/api/avatar/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: liveSession.sessionId, text: reply }),
        }).catch(() => {});
      }

      setMessages((prev) => [...prev, { role: "daddy", text: reply }]);
    } catch {
      setIsTalking(false);
      setMessages((prev) => [
        ...prev,
        { role: "daddy", text: "HAH! Looks like the signal's a bit fuzzy out here in the woods. Try again!" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, tripContext, liveSession]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="travel-daddy-wrapper">
      {/* Avatar: live HeyGen stream when available, approved portrait otherwise */}
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
        {!liveSession && (
          <Image
            src="/avatars/robjudy.jpg"
            alt="Travel Daddy, Judy's travel translator and guide"
            fill
            sizes="(max-width: 768px) 100vw, 65vw"
            priority
            className={`td-static-avatar${isTalking ? " is-talking" : ""}`}
          />
        )}
      </div>

      {/* Translate toggle button (gay-travel translation avatar) */}
      <button
        className={`td-translate-toggle${translateOpen ? " active" : ""}`}
        onClick={() => setTranslateOpen((v) => !v)}
        title="Translate a phrase"
      >
        <Languages size={18} />
      </button>

      {/* Translate panel — powered by Gemma via Hermes */}
      {translateOpen && (
        <div className="td-chat-panel td-translate-panel">
          <div className="td-chat-header">
            <div className="td-chat-title">
              <Languages size={16} />
              <span>Translate</span>
            </div>
            <button className="td-chat-close" onClick={() => setTranslateOpen(false)}>
              <X size={16} />
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
                <span>to</span>
                <select
                  className="td-translate-lang"
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                >
                  {[
                    "Spanish", "French", "Portuguese", "Italian", "German",
                    "Dutch", "Greek", "Thai", "Japanese", "Korean",
                    "Mandarin Chinese", "Arabic", "Turkish", "English",
                  ].map((lang) => (
                    <option key={lang} value={lang}>{lang}</option>
                  ))}
                </select>
              </label>
              <button
                className="td-send-btn td-translate-go"
                onClick={() =>
                  translation.submit({
                    input: translateText.trim(),
                    target_language: targetLang,
                  })
                }
                disabled={translation.isBusy || !translateText.trim()}
                title="Translate"
              >
                {translation.isBusy ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <Send size={16} />
                )}
              </button>
            </div>

            {translation.isBusy && (
              <div className="td-translate-hint">Asking Gemma…</div>
            )}
            {translation.status === "succeeded" && (
              <div className="td-translate-result">
                {extractHermesText(translation.result) || "No translation returned."}
              </div>
            )}
            {translation.status === "failed" && (
              <div className="td-translate-error">
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
          <MessageCircle size={20} />
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
              <div className="td-avatar-dot" />
              <span>{onboardingStatus === "pending" ? "Getting to know you" : "Travel Daddy"}</span>
            </div>
            <button className="td-chat-close" onClick={() => setChatOpen(false)}>
              <X size={16} />
            </button>
          </div>

          {onboardingStatus === "pending" ? (
            <OnboardingIntake
              userEmail={userEmail ?? ""}
              onDone={() => setOnboardingStatus("complete")}
            />
          ) : (
            <>
              <div className="td-chat-messages">
                {messages.map((msg, i) => (
                  <div key={i} className={`td-msg ${msg.role === "user" ? "td-msg-user" : "td-msg-daddy"}`}>
                    <span className="td-msg-avatar" aria-hidden>
                      {msg.role === "daddy" ? <Compass size={14} /> : userInitial}
                    </span>
                    <div className="td-msg-bubble">
                      {msg.text}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="td-msg td-msg-daddy">
                    <span className="td-msg-avatar" aria-hidden><Compass size={14} /></span>
                    <div className="td-msg-bubble td-typing">
                      <span /><span /><span />
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
                />
                <button
                  className="td-send-btn"
                  onClick={sendMessage}
                  disabled={isLoading || !input.trim()}
                  title="Send message"
                >
                  {isLoading ? <Loader2 size={18} className="spinner" /> : <Send size={18} />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
