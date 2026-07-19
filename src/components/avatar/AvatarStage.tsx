"use client";

import { Component, Suspense, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Bounds } from "@react-three/drei";
import AvatarMesh from "./AvatarMesh";
import type { RhubarbCue } from "@/lib/avatar/visemeTimeline";
import { getAvatarFacingRotation } from "@/lib/avatar/motion";
import type { ConversationPhase } from "./conversationMachine";

export interface AvatarStageProps {
  modelUrl: string;
  talking: boolean;
  phase: ConversationPhase;
  cues?: RhubarbCue[] | null;
  /**
   * Called at most once if the GLB fails to load or render (missing file,
   * malformed GLTF, WebGL unavailable, ...). The caller (TravelDaddy) should
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

export default function AvatarStage({
  modelUrl,
  talking,
  phase,
  cues,
  onUnavailable,
}: AvatarStageProps) {
  return (
    <AvatarErrorBoundary onUnavailable={onUnavailable}>
      <Canvas
        camera={{ position: [0, 0, 2.4], fov: 28, near: 0.05, far: 100 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => {
          // WebGL context creation can silently fail on some devices/CI
          // sandboxes; a null context means there's nothing usable to render.
          if (!gl.getContext()) onUnavailable?.();
        }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight position={[0.5, 1.2, 1]} intensity={1.1} />
        <Suspense fallback={null}>
          <Bounds fit clip observe margin={1.12}>
            <AvatarMesh
              modelUrl={modelUrl}
              talking={talking}
              phase={phase}
              cues={cues}
              facingRotationY={getAvatarFacingRotation(modelUrl)}
            />
          </Bounds>
        </Suspense>
      </Canvas>
    </AvatarErrorBoundary>
  );
}
