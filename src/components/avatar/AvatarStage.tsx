"use client";

import { Component, Suspense, useMemo, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds } from "@react-three/drei";
import AvatarMesh from "./AvatarMesh";
import type { RhubarbCue } from "@/lib/avatar/visemeTimeline";
import { getAvatarFacingRotation } from "@/lib/avatar/motion";
import type { EmotionPreset } from "@/lib/avatar/emotion";
import type { ConversationPhase } from "./conversationMachine";

export interface AvatarStageProps {
  modelUrl: string;
  talking: boolean;
  phase: ConversationPhase;
  cues?: RhubarbCue[] | null;
  /** Emotion preset derived from reply text (blended into avatar motion). */
  emotion?: EmotionPreset | null;
  /**
   * Called at most once if the GLB fails to load or render (missing file,
   * malformed GLTF, WebGL unavailable, ...). The caller (JudyDock) should
   * fall back to the static portrait — a broken 3D avatar must never leave
   * the person with nothing to look at.
   */
  onUnavailable?: () => void;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * Class component because React error boundaries require it — this is the
 * only way to catch a rejected Suspense promise (a failed GLTF fetch/parse)
 * rather than letting it blow up the whole avatar container.
 */
class AvatarErrorBoundary extends Component<
  { onUnavailable?: () => void; children: ReactNode },
  BoundaryState
> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onUnavailable?.();
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/* ── Phase-aware lighting colors ────────────────────────────────────── */

const PHASE_AMBIENT: Record<string, string> = {
  welcoming: '#ffecd2',  // warm amber
  listening: '#d6e8ff',  // cool blue
  thinking:  '#e8e0f0',  // soft lavender
  speaking:  '#fff3d4',  // golden
  error:     '#ffe0e0',  // muted rose
  editing:   '#e8e8ee',  // neutral
  paused:    '#e8e8ee',
  idle:      '#f0ecf4',  // very subtle lilac
};

const PHASE_AMBIENT_INTENSITY: Record<string, number> = {
  welcoming: 1.0,
  listening: 0.95,
  thinking:  0.85,
  speaking:  1.05,
  error:     0.9,
  editing:   0.85,
  paused:    0.8,
  idle:      0.9,
};

function PhaseAwareLighting({ phase }: { phase: ConversationPhase }) {
  const ambientColor = PHASE_AMBIENT[phase] ?? PHASE_AMBIENT.idle;
  const ambientIntensity = PHASE_AMBIENT_INTENSITY[phase] ?? 0.9;

  return (
    <>
      <ambientLight color={ambientColor} intensity={ambientIntensity} />
      {/* Key light — slightly warm, upper right */}
      <directionalLight position={[0.5, 1.2, 1]} intensity={1.1} />
      {/* Rim / back light — adds depth and separates avatar from background */}
      <directionalLight
        position={[-0.6, 0.8, -1]}
        intensity={0.35}
        color="#c8b8e8"
      />
      {/* Fill light — very subtle, from the left */}
      <directionalLight
        position={[-1, 0.2, 0.5]}
        intensity={0.2}
        color="#e8e0f0"
      />
    </>
  );
}

export default function AvatarStage({
  modelUrl,
  talking,
  phase,
  cues,
  emotion,
  onUnavailable,
}: AvatarStageProps) {
  const facingRotation = useMemo(() => getAvatarFacingRotation(modelUrl), [modelUrl]);

  return (
    <AvatarErrorBoundary onUnavailable={onUnavailable}>
      <Canvas
        camera={{ position: [0, 0, 2.4], fov: 28, near: 0.05, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        style={{ background: "transparent" }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          // WebGL context creation can silently fail on some devices/CI
          // sandboxes; a null context means there's nothing usable to render.
          if (!gl.getContext()) onUnavailable?.();
        }}
      >
        <PhaseAwareLighting phase={phase} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.12}>
            <AvatarMesh
              modelUrl={modelUrl}
              talking={talking}
              phase={phase}
              cues={cues}
              emotion={emotion}
              facingRotationY={facingRotation}
            />
          </Bounds>
        </Suspense>
      </Canvas>
    </AvatarErrorBoundary>
  );
}
