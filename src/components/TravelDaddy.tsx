"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { Send, Mic, MicOff, Loader2, MessageCircle, X } from "lucide-react";

interface ChatMessage {
  role: "user" | "daddy";
  text: string;
}

// Placeholder 3D lumberjack – used when HeyGen is unavailable
function PlaceholderLumberjack(props: any) {
  const group = useRef<THREE.Group>(null);
  const mouthRef = useRef<THREE.Mesh>(null);
  const [isTalking, setIsTalking] = useState(false);

  // Expose talking state via props
  useEffect(() => {
    if (props.isTalking !== undefined) {
      setIsTalking(props.isTalking);
    }
  }, [props.isTalking]);

  useFrame((state) => {
    if (group.current) {
      group.current.position.y = Math.sin(state.clock.elapsedTime * 2) * 0.05 - 1;
      group.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
    }
    // Animate mouth when talking
    if (mouthRef.current) {
      if (isTalking) {
        const mouthOpen = Math.abs(Math.sin(state.clock.elapsedTime * 12)) * 0.08;
        mouthRef.current.scale.y = 0.5 + mouthOpen * 5;
      } else {
        mouthRef.current.scale.y = 0.5;
      }
    }
  });

  return (
    <group ref={group} {...props} dispose={null}>
      {/* Torso - Flannel red lumberjack shirt */}
      <mesh castShadow receiveShadow position={[0, 1.5, 0]}>
        <boxGeometry args={[0.8, 1, 0.4]} />
        <meshStandardMaterial color="#b22222" />
      </mesh>
      {/* Flannel stripes */}
      <mesh castShadow position={[0, 1.5, 0.201]}>
        <boxGeometry args={[0.8, 0.08, 0.01]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh castShadow position={[0, 1.7, 0.201]}>
        <boxGeometry args={[0.8, 0.08, 0.01]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      <mesh castShadow position={[0, 1.3, 0.201]}>
        <boxGeometry args={[0.8, 0.08, 0.01]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      {/* Head */}
      <mesh castShadow receiveShadow position={[0, 2.3, 0]}>
        <sphereGeometry args={[0.35, 32, 32]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      {/* Bald head shine */}
      <mesh position={[0, 2.55, 0.1]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial color="#ffe4c9" transparent opacity={0.5} />
      </mesh>
      {/* Beard - salted red */}
      <mesh castShadow receiveShadow position={[0, 2.05, 0.2]}>
        <boxGeometry args={[0.35, 0.3, 0.15]} />
        <meshStandardMaterial color="#c44536" />
      </mesh>
      {/* Beard gray streaks */}
      <mesh position={[0.1, 2.05, 0.28]}>
        <boxGeometry args={[0.06, 0.25, 0.02]} />
        <meshStandardMaterial color="#a8a8a8" />
      </mesh>
      <mesh position={[-0.1, 2.05, 0.28]}>
        <boxGeometry args={[0.06, 0.25, 0.02]} />
        <meshStandardMaterial color="#b0b0b0" />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.1, 2.35, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#2d1b00" />
      </mesh>
      <mesh position={[0.1, 2.35, 0.3]}>
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshStandardMaterial color="#2d1b00" />
      </mesh>
      {/* Mouth */}
      <mesh ref={mouthRef} position={[0, 2.15, 0.32]}>
        <boxGeometry args={[0.12, 0.03, 0.02]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>
      {/* Beanie */}
      <mesh castShadow receiveShadow position={[0, 2.6, 0]}>
        <cylinderGeometry args={[0.36, 0.36, 0.2, 32]} />
        <meshStandardMaterial color="#228b22" />
      </mesh>
      {/* Arms */}
      <mesh castShadow position={[-0.55, 1.45, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 16]} />
        <meshStandardMaterial color="#b22222" />
      </mesh>
      <mesh castShadow position={[0.55, 1.45, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.8, 16]} />
        <meshStandardMaterial color="#b22222" />
      </mesh>
      {/* Hands */}
      <mesh position={[-0.55, 1.0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      <mesh position={[0.55, 1.0, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial color="#fcd9b8" />
      </mesh>
      {/* Legs - Blue jeans */}
      <mesh castShadow receiveShadow position={[-0.2, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 32]} />
        <meshStandardMaterial color="#000080" />
      </mesh>
      <mesh castShadow receiveShadow position={[0.2, 0.5, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 1, 32]} />
        <meshStandardMaterial color="#000080" />
      </mesh>
      {/* Boots */}
      <mesh position={[-0.2, -0.05, 0.05]}>
        <boxGeometry args={[0.2, 0.15, 0.3]} />
        <meshStandardMaterial color="#4a2810" />
      </mesh>
      <mesh position={[0.2, -0.05, 0.05]}>
        <boxGeometry args={[0.2, 0.15, 0.3]} />
        <meshStandardMaterial color="#4a2810" />
      </mesh>
      {/* Belt */}
      <mesh position={[0, 1.0, 0]}>
        <boxGeometry args={[0.82, 0.08, 0.42]} />
        <meshStandardMaterial color="#4a2810" />
      </mesh>
      {/* Belt buckle */}
      <mesh position={[0, 1.0, 0.22]}>
        <boxGeometry args={[0.1, 0.1, 0.02]} />
        <meshStandardMaterial color="#ffd700" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
}

interface TravelDaddyProps {
  tripContext?: any;
}

interface LiveAvatarSession {
  sessionId: string;
}

export default function TravelDaddy({ tripContext }: TravelDaddyProps) {
  const [chatOpen, setChatOpen] = useState(false);
  const [liveSession, setLiveSession] = useState<LiveAvatarSession | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContainerRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<import("livekit-client").Room | null>(null);

  // Try to start a HeyGen interactive avatar session; fall back to the
  // local 3D placeholder when unavailable (no key, quota, network, ...).
  useEffect(() => {
    let cancelled = false;
    let sessionId: string | null = null;

    const startLiveAvatar = async () => {
      try {
        const res = await fetch("/api/avatar/session", { method: "POST" });
        if (!res.ok) return; // 501 = not configured → placeholder
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
        // Any failure → keep the 3D placeholder silently.
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

      // Simulate talking duration based on reply length
      const talkDuration = Math.min(reply.length * 40, 5000);
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
      {/* Avatar: live HeyGen stream when available, 3D placeholder otherwise */}
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
          <Canvas shadows camera={{ position: [0, 2, 5], fov: 50 }}>
            <ambientLight intensity={0.5} />
            <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
            <PlaceholderLumberjack isTalking={isTalking} />
            <Environment preset="city" />
            <ContactShadows position={[0, -1, 0]} opacity={0.4} scale={10} blur={2} far={4} />
            <OrbitControls enableZoom={false} enablePan={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 2} />
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
                {msg.role === "daddy" && <span className="td-msg-avatar">🪓</span>}
                <div className="td-msg-bubble">
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="td-msg td-msg-daddy">
                <span className="td-msg-avatar">🪓</span>
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
