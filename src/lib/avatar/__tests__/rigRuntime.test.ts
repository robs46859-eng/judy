import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  ARKIT_CONTROLLED_MORPH_TARGETS,
  applyJawOpenRotation,
  clearMorphTargetInfluences,
  resolveMorphTargetIndex,
  restoreJawBindRotation,
} from '../rigRuntime';

describe('clearMorphTargetInfluences', () => {
  it('resolves Blender and ARKit left/right morph naming variants', () => {
    const dictionary = { mouthSmileLeft: 2, eyeBlinkRight: 5 };
    expect(resolveMorphTargetIndex(dictionary, 'mouthSmile_L')).toBe(2);
    expect(resolveMorphTargetIndex(dictionary, 'eyeBlink_R')).toBe(5);
  });

  it('clears every ARKit target while preserving unrelated morphs', () => {
    const mesh = {
      morphTargetDictionary: {
        jawOpen: 0,
        mouthPucker: 1,
        unrelatedBlink: 2,
      },
      morphTargetInfluences: [0.9, 0.7, 0.5],
    };

    clearMorphTargetInfluences([mesh], ARKIT_CONTROLLED_MORPH_TARGETS);

    expect(mesh.morphTargetInfluences).toEqual([0, 0, 0.5]);
  });
});

describe('jaw bind rotation', () => {
  it('opens relative to the imported bind pose and restores it exactly', () => {
    const jaw = new THREE.Bone();
    jaw.rotation.set(-0.806, 0.12, -0.05);
    const bindRotation = jaw.quaternion.clone();
    const expectedOpen = bindRotation
      .clone()
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.28));

    applyJawOpenRotation(jaw, bindRotation, 0);
    expect(jaw.quaternion.angleTo(bindRotation)).toBeLessThan(1e-6);

    applyJawOpenRotation(jaw, bindRotation, 1);
    expect(jaw.quaternion.angleTo(expectedOpen)).toBeLessThan(1e-6);

    restoreJawBindRotation(jaw, bindRotation);
    expect(jaw.quaternion.angleTo(bindRotation)).toBeLessThan(1e-6);
  });

  it('clamps out-of-range weights rather than over-rotating the jaw', () => {
    const jaw = new THREE.Bone();
    const bindRotation = jaw.quaternion.clone();

    applyJawOpenRotation(jaw, bindRotation, 4);

    expect(jaw.quaternion.angleTo(bindRotation)).toBeCloseTo(0.28, 6);
  });
});
