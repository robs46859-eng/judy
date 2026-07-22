import * as THREE from 'three';

import { ARKIT_VISEME_APPROXIMATION } from './visemeTimeline';

/** Morph targets that Judy owns while driving an ARKit-compatible face rig. */
export const ARKIT_CONTROLLED_MORPH_TARGETS = Array.from(
  new Set(
    Object.values(ARKIT_VISEME_APPROXIMATION).flatMap((targets) => Object.keys(targets))
  )
);

export interface MorphTargetController {
  morphTargetDictionary: Record<string, number>;
  morphTargetInfluences: number[];
}

function morphNameCandidates(name: string): string[] {
  return [
    name,
    name.replace(/_L\b/, 'Left').replace(/_R\b/, 'Right'),
    name.replace(/Left\b/, '_L').replace(/Right\b/, '_R'),
  ];
}

/** Resolve ARKit/Blender left-right naming variants without rig-specific code. */
export function resolveMorphTargetIndex(
  dictionary: Record<string, number>,
  name: string
): number | undefined {
  for (const candidate of morphNameCandidates(name)) {
    const index = dictionary[candidate];
    if (index !== undefined) return index;
  }
  return undefined;
}

/**
 * Clears only the named targets, leaving unrelated expressions and body
 * morphs untouched. This must run before each new ARKit frame so a target
 * used by the previous viseme cannot remain stuck on the face.
 */
export function clearMorphTargetInfluences(
  meshes: MorphTargetController[],
  names: readonly string[]
): void {
  for (const mesh of meshes) {
    for (const name of names) {
      const index = resolveMorphTargetIndex(mesh.morphTargetDictionary, name);
      if (index !== undefined) mesh.morphTargetInfluences[index] = 0;
    }
  }
}

const LOCAL_X_AXIS = new THREE.Vector3(1, 0, 0);
const JAW_DELTA = new THREE.Quaternion();

/**
 * Applies jaw opening relative to the imported bind pose. Copying the bind
 * quaternion on every frame avoids cumulative drift and preserves rigs whose
 * neutral jaw is not aligned to a zero Euler rotation.
 */
export function applyJawOpenRotation(
  jawBone: THREE.Bone,
  bindRotation: THREE.Quaternion,
  weight: number,
  maxJawOpenRadians = 0.28
): void {
  const boundedWeight = Math.min(1, Math.max(0, weight));
  JAW_DELTA.setFromAxisAngle(LOCAL_X_AXIS, boundedWeight * maxJawOpenRadians);
  jawBone.quaternion.copy(bindRotation).multiply(JAW_DELTA);
}

/** Restores the exact rotation imported from the GLB. */
export function restoreJawBindRotation(
  jawBone: THREE.Bone,
  bindRotation: THREE.Quaternion
): void {
  jawBone.quaternion.copy(bindRotation);
}
