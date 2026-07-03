"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { Send, Loader2, MessageCircle, X, Compass } from "lucide-react";

interface ChatMessage {
  role: "user" | "daddy";
  text: string;
}

/* ── Materials & textures ─────────────────────────────────── */

function usePlaidTexture() {
  return useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;

    // Warm flannel base
    ctx.fillStyle = "#8f4634";
    ctx.fillRect(0, 0, 256, 256);

    // Wide cross bands
    ctx.fillStyle = "rgba(58, 42, 34, 0.55)";
    for (let i = 0; i < 256; i += 64) {
      ctx.fillRect(i, 0, 22, 256);
      ctx.fillRect(0, i, 256, 22);
    }
    // Thin cream lines
    ctx.strokeStyle = "rgba(236, 229, 243, 0.5)";
    ctx.lineWidth = 3;
    for (let i = 32; i < 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    // Subtle weave noise (seeded LCG so render stays pure/deterministic)
    let seed = 42;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rand() * 0.06})`;
      ctx.fillRect(rand() * 256, rand() * 256, 2, 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2.5, 2.5);
    return tex;
  }, []);
}

const SKIN = "#c98e6b";
const SKIN_SHADOW = "#b57a58";
const HAIR = "#7a4a33";
const BEARD = "#8a5038";
const BEARD_GRAY = "#a89a90";
const IRIS = "#5a3c28";
const JEANS = "#3a4560";
const BOOT = "#4a3423";

/* ── Human Travel Daddy ───────────────────────────────────── */

function HumanTravelDaddy({ isTalking }: { isTalking: boolean }) {
  const root = useRef<THREE.Group>(null);
  const chest = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const jaw = useRef<THREE.Group>(null);
  const lidL = useRef<THREE.Mesh>(null);
  const lidR = useRef<THREE.Mesh>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const nextBlink = useRef(2.5);
  const blinkPhase = useRef(0);

  const plaid = usePlaidTexture();

  const skinMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.62 }),
    []
  );
  const shirtMat = useMemo(
    () => new THREE.MeshStandardMaterial({ map: plaid, roughness: 0.85 }),
    [plaid]
  );

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;

    // Human-paced idle: slow breathing, gentle weight shift
    if (chest.current) {
      const breathe = 1 + Math.sin(t * 1.4) * 0.012;
      chest.current.scale.set(breathe, 1, breathe);
    }
    if (root.current) {
      root.current.position.y = -0.92 + Math.sin(t * 0.7) * 0.008;
      root.current.rotation.y = Math.sin(t * 0.22) * 0.06;
      root.current.rotation.z = Math.sin(t * 0.31) * 0.008;
    }
    // Subtle head life: slow gaze drift, more engaged while talking
    if (head.current) {
      const engage = isTalking ? 1.6 : 1;
      head.current.rotation.y = Math.sin(t * 0.45) * 0.07 * engage;
      head.current.rotation.x = Math.sin(t * 0.35) * 0.035 + (isTalking ? 0.02 : 0);
      head.current.rotation.z = Math.sin(t * 0.2) * 0.015;
    }
    // Arms: relaxed micro-sway; a light gesture cadence while talking
    if (armL.current && armR.current) {
      const g = isTalking ? Math.sin(t * 2.1) * 0.06 : 0;
      armL.current.rotation.x = Math.sin(t * 0.8) * 0.02 + g;
      armR.current.rotation.x = Math.sin(t * 0.8 + 1.3) * 0.02 - g;
      armL.current.rotation.z = 0.08 + Math.sin(t * 0.6) * 0.01;
      armR.current.rotation.z = -0.08 - Math.sin(t * 0.6 + 0.7) * 0.01;
    }
    // Speech: jaw opens/closes at syllable pace with a phrase envelope
    if (jaw.current) {
      if (isTalking) {
        const syllable = Math.max(0, Math.sin(t * 11) * 0.6 + Math.sin(t * 7.3) * 0.4);
        const phrase = 0.55 + 0.45 * Math.abs(Math.sin(t * 1.7));
        jaw.current.rotation.x = 0.02 + syllable * phrase * 0.22;
      } else {
        jaw.current.rotation.x = THREE.MathUtils.lerp(jaw.current.rotation.x, 0, delta * 8);
      }
    }
    // Natural blinking every few seconds
    nextBlink.current -= delta;
    if (nextBlink.current <= 0) {
      blinkPhase.current = 0.14; // blink duration
      nextBlink.current = 2.5 + Math.random() * 3.5;
    }
    if (blinkPhase.current > 0) blinkPhase.current -= delta;
    const lidScale = blinkPhase.current > 0 ? 1 : 0.12;
    if (lidL.current && lidR.current) {
      lidL.current.scale.y = THREE.MathUtils.lerp(lidL.current.scale.y, lidScale, delta * 22);
      lidR.current.scale.y = THREE.MathUtils.lerp(lidR.current.scale.y, lidScale, delta * 22);
    }
  });

  return (
    <group ref={root} position={[0, -0.92, 0]}>
      {/* Legs */}
      <mesh castShadow position={[-0.11, 0.42, 0]}>
        <capsuleGeometry args={[0.085, 0.62, 8, 16]} />
        <meshStandardMaterial color={JEANS} roughness={0.9} />
      </mesh>
      <mesh castShadow position={[0.11, 0.42, 0]}>
        <capsuleGeometry args={[0.085, 0.62, 8, 16]} />
        <meshStandardMaterial color={JEANS} roughness={0.9} />
      </mesh>
      {/* Boots */}
      <mesh castShadow position={[-0.11, 0.05, 0.04]}>
        <boxGeometry args={[0.13, 0.1, 0.26]} />
        <meshStandardMaterial color={BOOT} roughness={0.7} />
      </mesh>
      <mesh castShadow position={[0.11, 0.05, 0.04]}>
        <boxGeometry args={[0.13, 0.1, 0.26]} />
        <meshStandardMaterial color={BOOT} roughness={0.7} />
      </mesh>

      {/* Torso (plaid flannel) */}
      <group ref={chest} position={[0, 1.05, 0]}>
        <mesh castShadow material={shirtMat}>
          <capsuleGeometry args={[0.21, 0.42, 8, 24]} />
        </mesh>
        {/* Collar */}
        <mesh position={[0, 0.28, 0.02]} material={shirtMat}>
          <torusGeometry args={[0.1, 0.035, 10, 24]} />
        </mesh>
        {/* Belt */}
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.215, 0.215, 0.06, 24]} />
          <meshStandardMaterial color={BOOT} roughness={0.6} />
        </mesh>
        <mesh position={[0, -0.3, 0.21]}>
          <boxGeometry args={[0.07, 0.05, 0.02]} />
          <meshStandardMaterial color="#c9a25a" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Arms */}
        <group ref={armL} position={[-0.26, 0.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0, 0, 0.12]} material={shirtMat}>
            <capsuleGeometry args={[0.062, 0.42, 8, 16]} />
          </mesh>
          <mesh castShadow position={[-0.055, -0.47, 0.01]} material={skinMat}>
            <sphereGeometry args={[0.062, 20, 20]} />
          </mesh>
        </group>
        <group ref={armR} position={[0.26, 0.18, 0]}>
          <mesh castShadow position={[0, -0.2, 0]} rotation={[0, 0, -0.12]} material={shirtMat}>
            <capsuleGeometry args={[0.062, 0.42, 8, 16]} />
          </mesh>
          <mesh castShadow position={[0.055, -0.47, 0.01]} material={skinMat}>
            <sphereGeometry args={[0.062, 20, 20]} />
          </mesh>
        </group>
      </group>

      {/* Neck */}
      <mesh position={[0, 1.44, 0]} material={skinMat}>
        <cylinderGeometry args={[0.062, 0.075, 0.12, 20]} />
      </mesh>

      {/* Head */}
      <group ref={head} position={[0, 1.62, 0]}>
        {/* Skull + face */}
        <mesh castShadow material={skinMat} scale={[0.9, 1.06, 0.94]}>
          <sphereGeometry args={[0.155, 32, 32]} />
        </mesh>

        {/* Hair — short, receding, natural */}
        <mesh position={[0, 0.075, -0.022]} scale={[0.94, 0.72, 0.96]}>
          <sphereGeometry args={[0.152, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={HAIR} roughness={0.95} />
        </mesh>

        {/* Ears */}
        <mesh position={[-0.14, -0.005, 0]} scale={[0.5, 1, 0.8]} material={skinMat}>
          <sphereGeometry args={[0.038, 16, 16]} />
        </mesh>
        <mesh position={[0.14, -0.005, 0]} scale={[0.5, 1, 0.8]} material={skinMat}>
          <sphereGeometry args={[0.038, 16, 16]} />
        </mesh>

        {/* Eyes: sclera, iris, pupil, lids */}
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.052, 0.018, 0.128]}>
            <mesh scale={[1, 0.82, 0.6]}>
              <sphereGeometry args={[0.026, 20, 20]} />
              <meshStandardMaterial color="#f4efe9" roughness={0.25} />
            </mesh>
            <mesh position={[0, 0, 0.013]}>
              <sphereGeometry args={[0.0125, 16, 16]} />
              <meshStandardMaterial color={IRIS} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, 0.021]}>
              <sphereGeometry args={[0.0055, 12, 12]} />
              <meshStandardMaterial color="#161010" roughness={0.1} />
            </mesh>
            {/* Eyelid (closes on blink) */}
            <mesh
              ref={side === -1 ? lidL : lidR}
              position={[0, 0.012, 0.004]}
              scale={[1.08, 0.12, 0.7]}
              material={skinMat}
            >
              <sphereGeometry args={[0.028, 16, 16]} />
            </mesh>
          </group>
        ))}

        {/* Eyebrows */}
        <mesh position={[-0.052, 0.062, 0.135]} rotation={[0.15, 0, 0.06]}>
          <boxGeometry args={[0.052, 0.011, 0.014]} />
          <meshStandardMaterial color={HAIR} roughness={0.95} />
        </mesh>
        <mesh position={[0.052, 0.062, 0.135]} rotation={[0.15, 0, -0.06]}>
          <boxGeometry args={[0.052, 0.011, 0.014]} />
          <meshStandardMaterial color={HAIR} roughness={0.95} />
        </mesh>

        {/* Nose */}
        <mesh position={[0, -0.02, 0.15]} scale={[0.7, 1, 0.9]} material={skinMat}>
          <sphereGeometry args={[0.026, 16, 16]} />
        </mesh>
        {/* Cheek warmth */}
        <mesh position={[-0.075, -0.03, 0.115]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={SKIN_SHADOW} roughness={0.7} transparent opacity={0.35} />
        </mesh>
        <mesh position={[0.075, -0.03, 0.115]} scale={[1, 0.7, 0.5]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshStandardMaterial color={SKIN_SHADOW} roughness={0.7} transparent opacity={0.35} />
        </mesh>

        {/* Mustache + upper lip (static) */}
        <mesh position={[0, -0.062, 0.138]} rotation={[0.35, 0, 0]} scale={[1, 0.55, 0.6]}>
          <sphereGeometry args={[0.042, 16, 16]} />
          <meshStandardMaterial color={BEARD} roughness={0.95} />
        </mesh>

        {/* Jaw group — rotates to open the mouth while speaking */}
        <group ref={jaw} position={[0, -0.06, 0.02]}>
          {/* Chin + jawline */}
          <mesh position={[0, -0.055, 0.055]} scale={[0.78, 0.62, 0.8]} material={skinMat}>
            <sphereGeometry args={[0.115, 24, 24]} />
          </mesh>
          {/* Lower lip */}
          <mesh position={[0, -0.028, 0.122]} scale={[1, 0.4, 0.5]}>
            <sphereGeometry args={[0.028, 16, 16]} />
            <meshStandardMaterial color="#a86450" roughness={0.55} />
          </mesh>
          {/* Mouth interior (visible when jaw opens) */}
          <mesh position={[0, -0.012, 0.1]} scale={[1, 0.5, 0.4]}>
            <sphereGeometry args={[0.026, 12, 12]} />
            <meshStandardMaterial color="#4a2028" roughness={0.9} />
          </mesh>
          {/* Beard around the jaw — salted auburn */}
          <mesh position={[0, -0.075, 0.05]} scale={[0.95, 0.75, 0.9]}>
            <sphereGeometry args={[0.118, 24, 24, 0, Math.PI * 2, Math.PI * 0.35, Math.PI * 0.65]} />
            <meshStandardMaterial color={BEARD} roughness={0.98} />
          </mesh>
          <mesh position={[-0.055, -0.085, 0.075]} scale={[0.4, 0.5, 0.35]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color={BEARD_GRAY} roughness={0.98} transparent opacity={0.6} />
          </mesh>
          <mesh position={[0.05, -0.09, 0.08]} scale={[0.35, 0.45, 0.3]}>
            <sphereGeometry args={[0.05, 12, 12]} />
            <meshStandardMaterial color={BEARD_GRAY} roughness={0.98} transparent opacity={0.5} />
          </mesh>
        </group>

        {/* Sideburns connecting hair to beard */}
        <mesh position={[-0.125, -0.045, 0.045]} scale={[0.35, 0.9, 0.55]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={BEARD} roughness={0.98} />
        </mesh>
        <mesh position={[0.125, -0.045, 0.045]} scale={[0.35, 0.9, 0.55]}>
          <sphereGeometry args={[0.05, 12, 12]} />
          <meshStandardMaterial color={BEARD} roughness={0.98} />
        </mesh>
      </group>
    </group>
  );
}

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
          <Canvas shadows camera={{ position: [0, 0.35, 2.4], fov: 40 }}>
            <ambientLight intensity={0.65} />
            <directionalLight position={[3, 5, 4]} intensity={1.1} castShadow />
            <directionalLight position={[-4, 2, -2]} intensity={0.3} color="#ece5f3" />
            <HumanTravelDaddy isTalking={isTalking} />
            <Environment preset="city" />
            <ContactShadows position={[0, -0.95, 0]} opacity={0.35} scale={6} blur={2.4} far={3} />
            <OrbitControls
              enableZoom={false}
              enablePan={false}
              maxPolarAngle={Math.PI / 2}
              minPolarAngle={Math.PI / 2.6}
              target={[0, 0.35, 0]}
            />
          </Canvas>
        )}
      </div>

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
