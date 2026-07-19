import type { ConversationPhase } from '@/components/avatar/conversationMachine';

export interface AvatarMotionSample {
  rootY: number;
  rootScale: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  earRoll: number;
  chestPitch: number;
}

const STILL: AvatarMotionSample = {
  rootY: 0,
  rootScale: 1,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  earRoll: 0,
  chestPitch: 0,
};

export function getAvatarFacingRotation(modelUrl: string): number {
  return modelUrl === '/models/judyface.glb' ? -Math.PI / 2 : 0;
}

/** Restrained deterministic motion; jaw and visemes are intentionally absent. */
export function sampleAvatarMotion(
  phase: ConversationPhase,
  elapsedSeconds: number,
  reducedMotion: boolean
): AvatarMotionSample {
  if (reducedMotion) return STILL;

  const breath = Math.sin(elapsedSeconds * 1.35);
  const slow = Math.sin(elapsedSeconds * 0.72);
  const emphasis = Math.sin(elapsedSeconds * 5);
  const base = {
    rootY: breath * 0.006,
    rootScale: 1 + breath * 0.003,
    headPitch: breath * 0.008,
    headYaw: slow * 0.012,
    headRoll: slow * 0.006,
    earRoll: breath * 0.01,
    chestPitch: breath * 0.004,
  };

  switch (phase) {
    case 'welcoming':
      return {
        ...base,
        headPitch: -0.018 + emphasis * 0.025,
        headYaw: slow * 0.035,
        earRoll: 0.025 + breath * 0.012,
        chestPitch: emphasis * 0.018,
      };
    case 'listening':
      return {
        ...base,
        headPitch: -0.045 + breath * 0.006,
        headYaw: slow * 0.018,
        headRoll: slow * 0.005,
        earRoll: 0.035 + breath * 0.012,
      };
    case 'thinking':
      return {
        ...base,
        headPitch: -0.012 + breath * 0.006,
        headYaw: 0.06 + slow * 0.025,
        headRoll: 0.055 + slow * 0.012,
        earRoll: 0.018 + breath * 0.008,
      };
    case 'speaking':
      return {
        ...base,
        rootY: breath * 0.008,
        rootScale: 1 + breath * 0.004,
        headPitch: -0.012 + emphasis * 0.035,
        headYaw: slow * 0.03,
        headRoll: slow * 0.012,
        earRoll: 0.022 + breath * 0.016,
        chestPitch: emphasis * 0.025,
      };
    case 'error':
      return { ...base, headPitch: 0.025, headRoll: -0.025 };
    case 'editing':
    case 'paused':
      return { ...base, headPitch: -0.015, headYaw: slow * 0.008 };
    case 'idle':
    default:
      return base;
  }
}
