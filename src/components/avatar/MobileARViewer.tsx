"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, MessageCircle, ScanLine, Send, X } from "lucide-react";
import {
  selectAvatarBehavior,
  type AvatarWeatherContext,
} from "@/lib/avatar/behavior";
import type { ConversationPhase } from "./conversationMachine";

const MODEL_VIEWER_SCRIPT_ID = "judy-model-viewer-script";
const MODEL_VIEWER_SCRIPT_SRC = "/vendor/model-viewer-4.3.1.min.js";

interface MobileARViewerProps {
  modelUrl: string;
  open: boolean;
  onClose: () => void;
  messages: ReadonlyArray<{ role: "user" | "judy"; text: string }>;
  isSending: boolean;
  talking: boolean;
  phase: ConversationPhase;
  emotionName?: string | null;
  weather?: AvatarWeatherContext | null;
  onSendMessage: (text: string) => void;
}

interface ModelViewerElement extends HTMLElement {
  canActivateAR?: boolean;
  availableAnimations?: string[];
  appendedAnimations?: string[];
  animationName?: string;
  currentTime?: number;
  updateComplete?: Promise<unknown>;
  play?: (options?: { repetitions?: number; pingpong?: boolean }) => void;
  appendAnimation?: (
    name: string,
    options?: { repetitions?: number; weight?: number; fade?: boolean | number }
  ) => void;
  detachAnimation?: (name: string, options?: { fade?: boolean | number }) => void;
}

interface ARStatusEvent extends Event {
  detail?: { status?: string };
}

export default function MobileARViewer({
  modelUrl,
  open,
  onClose,
  messages,
  isSending,
  talking,
  phase,
  emotionName,
  weather,
  onSendMessage,
}: MobileARViewerProps) {
  const viewerRef = useRef<ModelViewerElement | null>(null);
  const [viewerReady, setViewerReady] = useState(false);
  const [arError, setArError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [animationClock, setAnimationClock] = useState(0);
  const mainAnimationRef = useRef<string | null>(null);

  const behavior = selectAvatarBehavior({
    phase,
    talking,
    elapsedSeconds: animationClock,
    emotionName,
    weather,
  });

  const submitChat = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = chatInput.trim();
    if (!text || isSending) return;
    onSendMessage(text);
    setChatInput("");
  };

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    let cancelled = false;
    const markReady = () => {
      void window.customElements.whenDefined("model-viewer").then(() => {
        if (!cancelled) setViewerReady(true);
      });
    };

    if (window.customElements.get("model-viewer")) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.getElementById(MODEL_VIEWER_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      markReady();
      return () => {
        cancelled = true;
      };
    }

    const script = document.createElement("script");
    const markError = () => {
      if (!cancelled) setArError("The AR viewer could not load. Please try again.");
    };
    script.addEventListener("load", markReady);
    script.addEventListener("error", markError);
    script.id = MODEL_VIEWER_SCRIPT_ID;
    script.type = "module";
    script.src = MODEL_VIEWER_SCRIPT_SRC;
    document.head.appendChild(script);

    return () => {
      cancelled = true;
      script.removeEventListener("load", markReady);
      script.removeEventListener("error", markError);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    const startedAt = performance.now();
    const interval = window.setInterval(() => {
      setAnimationClock((performance.now() - startedAt) / 1000);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!open || !viewer) return;
    const handleStatus = (event: Event) => {
      if ((event as ARStatusEvent).detail?.status === "failed") {
        setArError("Live AR is not available on this phone. You can still rotate Judy in 3D.");
      }
    };
    viewer.addEventListener("ar-status", handleStatus);
    return () => viewer.removeEventListener("ar-status", handleStatus);
  }, [open, viewerReady]);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!open || !viewer) return;

    const configureAnimations = async () => {
      const available = viewer.availableAnimations ?? [];
      if (available.length === 0) return;
      const desired = available.includes(behavior.animationName) ? behavior.animationName : 'Idle';
      if (desired && desired !== mainAnimationRef.current) {
        viewer.animationName = desired;
        mainAnimationRef.current = desired;
        await viewer.updateComplete;
        viewer.currentTime = 0;
        viewer.play?.({ repetitions: Infinity });
      }

      const appended = viewer.appendedAnimations ?? [];
      if (available.includes('Blink') && !appended.includes('Blink')) {
        viewer.appendAnimation?.('Blink', { repetitions: Infinity, weight: 1, fade: 0.15 });
      }
      const isTalkingAppended = appended.includes('Judy_Talk');
      if (talking && available.includes('Judy_Talk') && !isTalkingAppended) {
        viewer.appendAnimation?.('Judy_Talk', { repetitions: Infinity, weight: 1, fade: 0.08 });
      } else if (!talking && isTalkingAppended) {
        viewer.detachAnimation?.('Judy_Talk', { fade: 0.12 });
      }
    };

    const handleLoad = () => void configureAnimations();
    viewer.addEventListener('load', handleLoad);
    void configureAnimations();
    return () => viewer.removeEventListener('load', handleLoad);
  }, [behavior.animationName, open, talking, viewerReady]);

  if (!open) return null;

  return (
    <div className="judy-ar-overlay" role="dialog" aria-modal="true" aria-labelledby="judy-ar-title">
      <div className="judy-ar-header">
        <div>
          <strong id="judy-ar-title">Judy in your space</strong>
          <span>Move your phone to find the floor, then place Judy beside you.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close AR viewer">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <model-viewer
        ref={viewerRef}
        className="judy-ar-model"
        src={modelUrl}
        alt="Judy Pierre, a purple rhino travel guide"
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-placement="floor"
        ar-scale="auto"
        camera-controls
        touch-action="pan-y"
        autoplay
        animation-name={behavior.animationName}
        animation-crossfade-duration="240"
        orientation="0deg 0deg 0deg"
        shadow-intensity="1.2"
        shadow-softness="0.8"
        exposure="1"
      >
        <button slot="ar-button" type="button" className="judy-ar-place-button">
          <ScanLine size={20} aria-hidden="true" />
          Place Judy in my space
        </button>

        <section className={`judy-ar-chat${chatOpen ? " is-open" : ""}`} aria-label="Chat with Judy in AR">
          <button
            type="button"
            className="judy-ar-chat-toggle"
            onClick={() => setChatOpen((current) => !current)}
            aria-expanded={chatOpen}
          >
            <MessageCircle size={18} aria-hidden="true" />
            Chat with Judy
          </button>

          {chatOpen && (
            <div className="judy-ar-chat-body">
              <div className="judy-ar-chat-messages" aria-live="polite">
                {messages.slice(-4).map((message, index) => (
                  <p key={`${message.role}-${index}`} className={`is-${message.role}`}>
                    <strong>{message.role === "judy" ? "Judy" : "You"}</strong>
                    <span>{message.text || (message.role === "judy" && isSending ? "Thinking…" : "")}</span>
                  </p>
                ))}
              </div>
              <form onSubmit={submitChat}>
                <label className="sr-only" htmlFor="judy-ar-chat-input">Message Judy</label>
                <input
                  id="judy-ar-chat-input"
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder="Ask Judy while you explore…"
                  autoComplete="off"
                />
                <button type="submit" disabled={!chatInput.trim() || isSending} aria-label="Send message to Judy">
                  {isSending ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Send size={18} aria-hidden="true" />}
                </button>
              </form>
            </div>
          )}
        </section>
      </model-viewer>

      {!viewerReady && !arError && <p className="judy-ar-status">Preparing the live AR viewer…</p>}
      {arError && <p className="judy-ar-status is-error" role="status">{arError}</p>}
      <p className="judy-ar-privacy">Your camera view stays on your phone and is not uploaded.</p>
    </div>
  );
}
