"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import {
  RHUBARB_SHAPES,
  getVisemeWeights,
  visemeMorphTargetName,
  ARKIT_VISEME_APPROXIMATION,
  approximateTalkingJawWeight,
  type RhubarbCue,
} from "@/lib/avatar/visemeTimeline";

export interface AvatarMeshProps {
  /** Path under /public to the rigged GLB. */
  modelUrl: string;
  /** True while Travel Daddy is speaking (drives the stage-1 fallback). */
  talking: boolean;
  /**
   * Rhubarb mouth-cue timeline for the current utterance (stage 2). When
   * present and the model has viseme/ARKit morph targets, this drives
   * accurate lip sync instead of the stage-1 approximation. A new array
   * reference is treated as a new utterance and resets playback time to 0.
   */
  cues?: RhubarbCue[] | null;
  /** Reported once, if the GLTF fails to parse after loading. */
  onRigError?: (message: string) => void;
}

type MorphMesh = THREE.Mesh & {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
};

interface Rig {
  morphMeshes: MorphMesh[];
  jawBone: THREE.Bone | null;
  hasVisemeTargets: boolean;
  hasArkitTargets: boolean;
}

function isMorphMesh(obj: THREE.Object3D): obj is MorphMesh {
  const mesh = obj as Partial<MorphMesh>;
  return (
    !!mesh.morphTargetDictionary &&
    Array.isArray(mesh.morphTargetInfluences) &&
    mesh.morphTargetInfluences.length > 0
  );
}

/** Finds a jaw bone by common naming conventions (Mixamo, generic rigs). */
function findJawBone(root: THREE.Object3D): THREE.Bone | null {
  let found: THREE.Bone | null = null;
  root.traverse((obj) => {
    if (found) return;
    if ((obj as THREE.Bone).isBone && /jaw/i.test(obj.name)) {
      found = obj as THREE.Bone;
    }
  });
  return found;
}

function buildRig(scene: THREE.Object3D, onRigError?: (message: string) => void): Rig {
  const morphMeshes: MorphMesh[] = [];
  scene.traverse((obj) => {
    if (isMorphMesh(obj)) morphMeshes.push(obj);
  });
  const jawBone = findJawBone(scene);

  if (morphMeshes.length === 0 && !jawBone) {
    onRigError?.(
      "No morph targets or jaw bone found on the rigged model — showing the static pose."
    );
  }

  const visemeNames = RHUBARB_SHAPES.map(visemeMorphTargetName);
  const hasVisemeTargets = morphMeshes.some((m) =>
    visemeNames.some((n) => m.morphTargetDictionary[n] !== undefined)
  );
  const hasArkitTargets = morphMeshes.some((m) =>
    Object.keys(m.morphTargetDictionary).some((n) => /jawOpen|mouthClose/i.test(n))
  );

  return { morphMeshes, jawBone, hasVisemeTargets, hasArkitTargets };
}

/** Resets a mesh's morph influences to 0 for every known target. */
function resetMorphTargets(meshes: MorphMesh[], names: string[]) {
  for (const mesh of meshes) {
    for (const name of names) {
      const index = mesh.morphTargetDictionary[name];
      if (index !== undefined) mesh.morphTargetInfluences[index] = 0;
    }
  }
}

export default function AvatarMesh({ modelUrl, talking, cues, onRigError }: AvatarMeshProps) {
  const { scene } = useGLTF(modelUrl);
  const startedAtRef = useRef<number | null>(null);
  const cuesRef = useRef<RhubarbCue[] | null | undefined>(cues);
  // The rig is inspected once per loaded scene and then mutated every frame
  // inside useFrame — that's the standard react-three-fiber pattern
  // (imperative per-frame updates via refs, not React state/useMemo), so it
  // lives in a ref rather than memoized state.
  const rigRef = useRef<Rig | null>(null);

  useEffect(() => {
    rigRef.current = buildRig(scene, onRigError);
    return () => {
      const rig = rigRef.current;
      if (rig) resetMorphTargets(rig.morphMeshes, RHUBARB_SHAPES.map(visemeMorphTargetName));
    };
  }, [scene, onRigError]);

  // A new cues array (new utterance) or a fresh talking=true both restart
  // the local playback clock so the timeline/approximation starts at t=0.
  useEffect(() => {
    if (cues !== cuesRef.current || talking) {
      startedAtRef.current = performance.now();
      cuesRef.current = cues;
    }
    if (!talking && !cues) {
      startedAtRef.current = null;
    }
  }, [talking, cues]);

  // react-three-fiber's useFrame is the sanctioned place to imperatively
  // mutate Three.js objects (mesh.morphTargetInfluences, bone.rotation)
  // every frame — that's the entire point of this component, and it's
  // fundamentally what every r3f app does here instead of triggering a
  // React re-render 60 times a second. The newer `react-hooks/immutability`
  // rule can't distinguish that from an accidental mutation of a hook
  // value, so it's disabled for this block specifically.
  /* eslint-disable react-hooks/immutability */
  useFrame(({ clock }) => {
    const rig = rigRef.current;
    if (!rig) return;

    const started = startedAtRef.current;
    const elapsed = started === null ? 0 : (performance.now() - started) / 1000;

    let jawWeight = 0;
    let visemeWeights: Record<string, number> | null = null;

    if (cues && cues.length > 0) {
      visemeWeights = getVisemeWeights(cues, elapsed);
    } else {
      jawWeight = approximateTalkingJawWeight(clock.getElapsedTime(), talking);
    }

    if (rig.hasVisemeTargets && visemeWeights) {
      for (const mesh of rig.morphMeshes) {
        for (const shape of RHUBARB_SHAPES) {
          const idx = mesh.morphTargetDictionary[visemeMorphTargetName(shape)];
          if (idx !== undefined) mesh.morphTargetInfluences[idx] = visemeWeights[shape] ?? 0;
        }
      }
      return;
    }

    if (rig.hasArkitTargets) {
      const weightSource: Record<string, number> = visemeWeights
        ? Object.fromEntries(
            RHUBARB_SHAPES.map((shape) => [shape, visemeWeights![shape] ?? 0])
          )
        : { A: jawWeight };

      for (const mesh of rig.morphMeshes) {
        const combined: Record<string, number> = {};
        for (const shape of RHUBARB_SHAPES) {
          const shapeWeight = weightSource[shape] ?? 0;
          if (shapeWeight <= 0) continue;
          const approximation = ARKIT_VISEME_APPROXIMATION[shape];
          for (const [target, multiplier] of Object.entries(approximation)) {
            combined[target] = Math.max(combined[target] ?? 0, shapeWeight * multiplier);
          }
        }
        if (!visemeWeights) {
          combined.jawOpen = Math.max(combined.jawOpen ?? 0, jawWeight);
        }
        for (const [target, weight] of Object.entries(combined)) {
          const idx = mesh.morphTargetDictionary[target];
          if (idx !== undefined) mesh.morphTargetInfluences[idx] = weight;
        }
      }
      return;
    }

    if (rig.jawBone) {
      // Simple bone-rotation fallback for rigs with no facial morph targets
      // at all — open around the local X axis, small enough to stay
      // believable rather than unhinged.
      const maxJawOpenRadians = 0.28;
      const weight = visemeWeights ? 1 - (visemeWeights.X ?? 0) : jawWeight;
      rig.jawBone.rotation.x = weight * maxJawOpenRadians;
    }
  });
  /* eslint-enable react-hooks/immutability */

  return <primitive object={scene} />;
}
