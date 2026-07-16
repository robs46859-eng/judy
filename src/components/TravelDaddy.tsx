"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  useGLTF,
  useAnimations,
} from "@react-three/drei";
import {
  Suspense,
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import * as THREE from "three";
import { Send, Loader2, MessageCircle, X, Compass, Languages } from "lucide-react";
import { useHermesJob } from "@/lib/hermes/useHermesJob";
import { extractHermesText } from "@/lib/hermes/result";

interface ChatMessage {
  role: "user" | "daddy";
  text: string;
}

/* ── Avatar model ─────────────────────────────────────────────
   Loads the glTF avatar (public/models/JobuJudy.glb — a placeholder
   for now). Written generically so any rigged glTF drops in without
   code changes: the model is auto-centered and scaled to frame, and
   idle / talking clips are chosen by name with graceful fallbacks.
   ──────────────────────────────────────────────────────────── */

const AVATAR_URL = "/models/JobuJudy.glb";

// Target height (world units) the model is scaled to fill in-frame.
const AVATAR_HEIGHT = 1.5;

/** First clip whose name contains one of `candidates` (case-insensitive);
 *  falls back to the clip at `fallbackIndex`, or null if there are none. */
function pickClip(
  names: string[],
  candidates: string[],
  fallbackIndex = 0
): string | null {
  if (names.length === 0) return null;
  for (const c of candidates) {
    const hit = names.find((n) => n.toLowerCase().includes(c));
    if (hit) return hit;
  }
  return names[fallbackIndex] ?? null;
}

function AvatarModel({ isTalking }: { isTalking: boolean }) {
  const group = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(AVATAR_URL);
  const { actions, names } = useAnimations(animations, group);

  // Shadows on every mesh.
  useEffect(() => {
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [scene]);

  // Auto-fit: center horizontally, rest the model's feet on y = 0, and
  // scale so its tallest dimension reads at AVATAR_HEIGHT.
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = AVATAR_HEIGHT / maxDim;
    const position: [number, number, number] = [
      -center.x * scale,
      -box.min.y * scale,
      -center.z * scale,
    ];
    return { scale, position };
  }, [scene]);

  // Idle when quiet; a livelier / jaw-moving clip while "speaking".
  // Names are matched loosely so a future avatar with proper
  // idle/talk/wave clips just works.
  const idleClip = useMemo(
    () => pickClip(names, ["idle", "breath", "stand", "playing", "photo"]),
    [names]
  );
  const talkClip = useMemo(
    () => pickClip(names, ["talk", "speak", "eating", "drinking", "playing"]),
    [names]
  );

  // Crossfade between the current idle/talk clip.
  useEffect(() => {
    const clip = isTalking ? talkClip : idleClip;
    if (!clip) return;
    const action = actions[clip];
    if (!action) return;
    action
      .reset()
      .setLoop(THREE.LoopRepeat, Infinity)
      .setEffectiveTimeScale(isTalking ? 1.15 : 1)
      .setEffectiveWeight(1)
      .fadeIn(0.35)
      .play();
    return () => {
      action.fadeOut(0.35);
    };
  }, [isTalking, idleClip, talkClip, actions]);

  // A touch of ambient life on the root — a slow gaze-sway, a hair more
  // engaged while talking. (Root transform only; never fights the mixer.)
  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    const engage = isTalking ? 1.5 : 1;
    group.current.rotation.y = Math.sin(t * 0.25) * 0.08 * engage;
    group.current.position.y = Math.sin(t * 0.7) * 0.01;
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={scene} scale={fit.scale} position={fit.position} />
    </group>
  );
}

useGLTF.preload(AVATAR_URL);

/* ── Component ────────────────────────────────────────────── */

interface TravelDaddyProps {
  tripContext?: any;
  userName?: string;
}

interface LiveAvatarSession {
  sessionId: string;
}

export default function TravelDaddy({ tripContext, userName }: TravelDaddyProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [translateOpen, setTranslateOpen] = useState(false);
  const [translateText, setTranslateText] = useState("");
  const [targetLang, setTargetLang] = useState("Spanish");
  const translation = useHermesJob("translate");
  const [liveSession, setLiveSession] = useState<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);

  const userInitial = (userName || "You").trim().charAt(0).toUpperCase();

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
      {/* Avatar: live HeyGen stream when available, 3D model otherwise */}
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
          <Canvas shadows camera={{ position: [0, 0.75, 2.6], fov: 42 }}>
            <ambientLight intensity={0.65} />
            <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
            <directionalLight position={[-4, 2, -2]} intensity={0.3} color="#ece5f3" />
            <Suspense fallback={null}>
              <AvatarModel isTalking={isTalking} />
              <Environment preset="city" />
            </Suspense>
            <ContactShadows position={[0, 0, 0]} opacity={0.35} scale={6} blur={2.4} far={3} />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              maxPolarAngle={Math.PI / 2}
              minPolarAngle={Math.PI / 2.6}
              target={[0, 0.7, 0]}
            />
          </Canvas>
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

      {/* Chat panel */}
      {chatOpen && (
        <div className="td-chat-panel">
          <div className="td-chat-header">
            <div className="td-chat-title">
              <div className="td-avatar-dot" />
              <span>Travel Daddy</span>
            </div>
            <button className="td-chat-close" onClick={() => setChatOpen(false)}>
              <X size={16} />
            </button>
          </div>

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
        </div>
      )}
    </div>
  );
}
