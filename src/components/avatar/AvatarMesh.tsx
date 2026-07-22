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
import {
  ARKIT_CONTROLLED_MORPH_TARGETS,
  applyJawOpenRotation,
  clearMorphTargetInfluences,
  resolveMorphTargetIndex,
  restoreJawBindRotation,
} from "@/lib/avatar/rigRuntime";
import {
  getAvatarHeadPitchOffset,
  sampleAvatarMotion,
  speechEnergyNod,
} from "@/lib/avatar/motion";
import type { EmotionPreset } from "@/lib/avatar/emotion";
import {
  samplePlatformWalk,
  selectAvatarBehavior,
  type AvatarWeatherContext,
} from "@/lib/avatar/behavior";
import type { ConversationPhase } from "./conversationMachine";

/** Morph target names for eye blink (ARKit convention). */
const BLINK_TARGETS = [
  'eyeBlink_L',
  'eyeBlink_R',
  'eyeBlinkLeft',
  'eyeBlinkRight',
] as const;

const EXPRESSION_TARGETS = [
  'mouthSmile_L', 'mouthSmile_R', 'mouthFrown_L', 'mouthFrown_R',
  'cheekSquint_L', 'cheekSquint_R', 'browInnerUp', 'browDown_L',
  'browDown_R', 'mouthPucker',
] as const;

export interface AvatarMeshProps {
  /** Path under /public to the rigged GLB. */
  modelUrl: string;
  /** True while Judy Pierre is speaking (drives the stage-1 fallback). */
  talking: boolean;
  /**
   * Rhubarb mouth-cue timeline for the current utterance (stage 2). When
   * present and the model has viseme/ARKit morph targets, this drives
   * accurate lip sync instead of the stage-1 approximation. A new array
   * reference is treated as a new utterance and resets playback time to 0.
   */
  cues?: RhubarbCue[] | null;
  phase: ConversationPhase;
  facingRotationY?: number;
  /** Emotion preset detected from the current reply text. */
  emotion?: EmotionPreset | null;
  /** Current destination weather, used only for ambient body language. */
  weather?: AvatarWeatherContext | null;
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
  jawBindRotation: THREE.Quaternion | null;
  hasVisemeTargets: boolean;
  hasArkitTargets: boolean;
  rootBindY: number;
  rootBindScale: THREE.Vector3;
  motionBones: {
    head: MotionBone | null;
    neck: MotionBone | null;
    leftEar: MotionBone | null;
    rightEar: MotionBone | null;
    chest: MotionBone | null;
    spine: MotionBone | null;
  };
}

interface MotionBone {
  bone: THREE.Bone;
  bindRotation: THREE.Quaternion;
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

function findMotionBone(root: THREE.Object3D, pattern: RegExp): MotionBone | null {
  let found: THREE.Bone | null = null;
  root.traverse((object) => {
    if (found || !(object as THREE.Bone).isBone) return;
    if (pattern.test(object.name)) found = object as THREE.Bone;
  });
  if (!found) return null;
  const bone = found as THREE.Bone;
  return { bone, bindRotation: bone.quaternion.clone() };
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

  return {
    morphMeshes,
    jawBone,
    jawBindRotation: jawBone?.quaternion.clone() ?? null,
    hasVisemeTargets,
    hasArkitTargets,
    rootBindY: scene.position.y,
    rootBindScale: scene.scale.clone(),
    motionBones: {
      head: findMotionBone(scene, /^head$/i),
      neck: findMotionBone(scene, /^neck$/i),
      leftEar: findMotionBone(scene, /^ear[._-]?l$/i),
      rightEar: findMotionBone(scene, /^ear[._-]?r$/i),
      chest: findMotionBone(scene, /^chest$/i),
      spine: findMotionBone(scene, /^spine$/i),
    },
  };
}

const motionEuler = new THREE.Euler();
const motionDelta = new THREE.Quaternion();

function applyMotionBone(
  target: MotionBone | null,
  pitch: number,
  yaw: number,
  roll: number
) {
  if (!target) return;
  motionEuler.set(pitch, yaw, roll, "XYZ");
  motionDelta.setFromEuler(motionEuler);
  target.bone.quaternion.copy(target.bindRotation).multiply(motionDelta);
}

function restoreMotionRig(scene: THREE.Object3D, rig: Rig) {
  scene.position.y = rig.rootBindY;
  scene.scale.copy(rig.rootBindScale);
  for (const target of Object.values(rig.motionBones)) {
    if (target) target.bone.quaternion.copy(target.bindRotation);
  }
}

export default function AvatarMesh({
  modelUrl,
  talking,
  cues,
  phase,
  facingRotationY = 0,
  emotion,
  weather,
  onRigError,
}: AvatarMeshProps) {
  const { scene, animations } = useGLTF(modelUrl);
  const avatarRootRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const actionsRef = useRef<Map<string, THREE.AnimationAction>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentActionNameRef = useRef<string | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const cuesRef = useRef<RhubarbCue[] | null | undefined>(cues);
  // The rig is inspected once per loaded scene and then mutated every frame
  // inside useFrame — that's the standard react-three-fiber pattern
  // (imperative per-frame updates via refs, not React state/useMemo), so it
  // lives in a ref rather than memoized state.
  const rigRef = useRef<Rig | null>(null);
  const reducedMotionRef = useRef(false);
  const cameraFacingHeadPitch = getAvatarHeadPitchOffset(modelUrl);

  useEffect(() => {
    rigRef.current = buildRig(scene, onRigError);
    return () => {
      const rig = rigRef.current;
      if (!rig) return;
      clearMorphTargetInfluences(rig.morphMeshes, [
        ...RHUBARB_SHAPES.map(visemeMorphTargetName),
        ...ARKIT_CONTROLLED_MORPH_TARGETS,
      ]);
      if (rig.jawBone && rig.jawBindRotation) {
        restoreJawBindRotation(rig.jawBone, rig.jawBindRotation);
      }
      restoreMotionRig(scene, rig);
    };
  }, [scene, onRigError]);

  useEffect(() => {
    const avatarRoot = avatarRootRef.current;
    const mixer = new THREE.AnimationMixer(scene);
    const actions = new Map<string, THREE.AnimationAction>();
    for (const clip of animations) actions.set(clip.name, mixer.clipAction(clip));
    mixerRef.current = mixer;
    actionsRef.current = actions;

    const idle = actions.get('Idle') ?? null;
    if (idle) {
      idle.reset().play();
      currentActionRef.current = idle;
      currentActionNameRef.current = 'Idle';
    }

    return () => {
      mixer.stopAllAction();
      mixer.uncacheRoot(scene);
      mixerRef.current = null;
      actionsRef.current = new Map();
      currentActionRef.current = null;
      currentActionNameRef.current = null;
      if (avatarRoot) {
        avatarRoot.position.set(0, 0, 0);
        avatarRoot.rotation.set(0, 0, 0);
      }
    };
  }, [animations, scene]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotionRef.current = media.matches;
    };
    update();
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

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
  useFrame(({ clock }, delta) => {
    const rig = rigRef.current;
    if (!rig) return;

    const elapsed = clock.getElapsedTime();
    const behavior = selectAvatarBehavior({
      phase,
      talking,
      elapsedSeconds: elapsed,
      emotionName: emotion?.name,
      weather,
      reducedMotion: reducedMotionRef.current,
    });
    const actions = actionsRef.current;
    const requestedName = actions.has(behavior.animationName) ? behavior.animationName : 'Idle';
    if (requestedName !== currentActionNameRef.current) {
      const next = actions.get(requestedName) ?? null;
      if (next) {
        currentActionRef.current?.fadeOut(0.24);
        next.reset().fadeIn(0.24).play();
        currentActionRef.current = next;
        currentActionNameRef.current = requestedName;
      }
    }
    mixerRef.current?.update(Math.min(delta, 0.05));

    if (avatarRootRef.current) {
      const walk = behavior.walking ? samplePlatformWalk(elapsed) : { x: 0, z: 0, yaw: 0 };
      avatarRootRef.current.position.set(walk.x, 0, walk.z);
      avatarRootRef.current.rotation.set(0, walk.yaw, 0);
    }

    const motion = sampleAvatarMotion(
      phase,
      elapsed,
      reducedMotionRef.current,
      emotion
    );
    scene.position.y = rig.rootBindY + motion.rootY;
    scene.scale.copy(rig.rootBindScale).multiplyScalar(motion.rootScale);
    applyMotionBone(
      rig.motionBones.head,
      motion.headPitch + cameraFacingHeadPitch,
      motion.headYaw,
      motion.headRoll
    );
    applyMotionBone(
      rig.motionBones.neck,
      motion.headPitch * 0.35 + cameraFacingHeadPitch * 0.2,
      motion.headYaw * 0.35,
      motion.headRoll * 0.25
    );
    applyMotionBone(rig.motionBones.leftEar, 0, 0, motion.earRoll);
    applyMotionBone(rig.motionBones.rightEar, 0, 0, -motion.earRoll);
    applyMotionBone(rig.motionBones.chest, motion.chestPitch, 0, 0);
    applyMotionBone(rig.motionBones.spine, motion.chestPitch * 0.45, 0, 0);

    // ── Blink animation ──────────────────────────────────
    if (motion.blinkWeight > 0) {
      for (const mesh of rig.morphMeshes) {
        for (const target of BLINK_TARGETS) {
          const idx = resolveMorphTargetIndex(mesh.morphTargetDictionary, target);
          if (idx !== undefined) {
            mesh.morphTargetInfluences[idx] = motion.blinkWeight;
          }
        }
      }
    } else {
      for (const mesh of rig.morphMeshes) {
        for (const target of BLINK_TARGETS) {
          const idx = resolveMorphTargetIndex(mesh.morphTargetDictionary, target);
          if (idx !== undefined) {
            mesh.morphTargetInfluences[idx] = 0;
          }
        }
      }
    }

    const started = startedAtRef.current;
    const speechElapsed = started === null ? 0 : (performance.now() - started) / 1000;

    let jawWeight = 0;
    let visemeWeights: Record<string, number> | null = null;

    if (cues && cues.length > 0) {
      visemeWeights = getVisemeWeights(cues, speechElapsed);
      // Speech-energy head nod: derive energy from total viseme openness
      const energy = visemeWeights
        ? Object.values(visemeWeights).reduce((sum, w) => sum + w, 0) / RHUBARB_SHAPES.length
        : 0;
      if (energy > 0.05) {
        const nod = speechEnergyNod(energy);
        applyMotionBone(
          rig.motionBones.head,
          motion.headPitch + cameraFacingHeadPitch + nod,
          motion.headYaw,
          motion.headRoll
        );
      }
    } else {
      jawWeight = approximateTalkingJawWeight(elapsed, talking);
    }

    // Reset all ARKit targets before choosing this frame's animation path.
    // Without this, targets that are absent from the next viseme retain their
    // previous weight, and switching to dedicated visemes can leave an old
    // ARKit mouth shape stuck on the face.
    clearMorphTargetInfluences(rig.morphMeshes, EXPRESSION_TARGETS);
    if (rig.hasArkitTargets) {
      clearMorphTargetInfluences(rig.morphMeshes, ARKIT_CONTROLLED_MORPH_TARGETS);
    }

    if (rig.hasVisemeTargets) {
      for (const mesh of rig.morphMeshes) {
        for (const shape of RHUBARB_SHAPES) {
          const idx = mesh.morphTargetDictionary[visemeMorphTargetName(shape)];
          if (idx !== undefined) {
            // Accurate Rhubarb cues take priority. If the optional TTS/Rhubarb
            // path is unavailable, browser speech still gets a simple open-mouth
            // fallback on viseme_A instead of relying on an unweighted jaw bone.
            mesh.morphTargetInfluences[idx] = visemeWeights
              ? (visemeWeights[shape] ?? 0)
              : shape === "A"
                ? jawWeight
                : 0;
          }
        }
      }
    } else if (rig.hasArkitTargets) {
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
          const idx = resolveMorphTargetIndex(mesh.morphTargetDictionary, target);
          if (idx !== undefined) mesh.morphTargetInfluences[idx] = weight;
        }
      }
    } else if (rig.jawBone && rig.jawBindRotation) {
      // Simple bone-rotation fallback for rigs with no facial morph targets
      // at all — open around the local X axis, small enough to stay
      // believable rather than unhinged. The delta is relative to the GLB's
      // imported bind pose, which is also restored during cleanup.
      const weight = visemeWeights ? 1 - (visemeWeights.X ?? 0) : jawWeight;
      applyJawOpenRotation(rig.jawBone, rig.jawBindRotation, weight);
    }

    // Expressions are applied last so ARKit mouth resets and Rhubarb visemes
    // cannot immediately erase Judy's smile/frown on compatible rigs.
    for (const [target, weight] of Object.entries(motion.microExpressions)) {
      if (!weight) continue;
      for (const mesh of rig.morphMeshes) {
        const idx = resolveMorphTargetIndex(mesh.morphTargetDictionary, target);
        if (idx !== undefined) {
          mesh.morphTargetInfluences[idx] = Math.min(
            1,
            Math.max(mesh.morphTargetInfluences[idx] ?? 0, weight)
          );
        }
      }
    }
  });
  /* eslint-enable react-hooks/immutability */

  return (
    <group rotation={[0, facingRotationY, 0]}>
      <mesh position={[0, -0.03, 0]} receiveShadow>
        <cylinderGeometry args={[0.8, 0.86, 0.06, 64]} />
        <meshStandardMaterial
          color="#5f486f"
          roughness={0.92}
          metalness={0.04}
        />
      </mesh>
      <group ref={avatarRootRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}
