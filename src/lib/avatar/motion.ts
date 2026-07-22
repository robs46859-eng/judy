import type { ConversationPhase } from '@/components/avatar/conversationMachine';
import type { EmotionPreset } from './emotion';

export interface AvatarMotionSample {
  rootY: number;
  rootScale: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  earRoll: number;
  chestPitch: number;
  /** 0 = eyes open, 1 = eyes fully closed. Driven by the blink cycle. */
  blinkWeight: number;
  /**
   * Phase-aware micro-expression morph weights (ARKit names → [0,1]).
   * Applied additively on top of lip-sync / jaw motion.
   */
  microExpressions: Partial<Record<string, number>>;
}

const STILL: AvatarMotionSample = {
  rootY: 0,
  rootScale: 1,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  earRoll: 0,
  chestPitch: 0,
  blinkWeight: 0,
  microExpressions: {},
};

export function getAvatarFacingRotation(modelUrl: string): number {
  const pathname = modelUrl.split('?', 1)[0].toLowerCase();
  // Cancel the tiny yaw baked into agreejudy's exported root transform.
  if (/\/agreejudy\.glb$/.test(pathname)) return 0.0046;
  return /\/judyface\.(?:glb|gltf)$/.test(pathname) ? -Math.PI / 2 : 0;
}

/** Correct the slight chin-up bind pose on the current Judy rig. */
export function getAvatarHeadPitchOffset(modelUrl: string): number {
  const pathname = modelUrl.split('?', 1)[0].toLowerCase();
  return /\/agreejudy\.glb$/.test(pathname) ? Math.PI / 18 : 0;
}

/* ── Blink cycle ──────────────────────────────────────────────────────── */

/** Average seconds between blinks. Actual interval is randomized ±40%. */
const BLINK_INTERVAL = 3.5;
/** Duration of the close phase in seconds. */
const BLINK_CLOSE_DURATION = 0.08;
/** Duration of the open phase in seconds. */
const BLINK_OPEN_DURATION = 0.12;
const BLINK_TOTAL = BLINK_CLOSE_DURATION + BLINK_OPEN_DURATION;

/**
 * Deterministic blink weight from elapsed time. Uses a simple sawtooth
 * pattern with a pseudo-random offset so different start times don't all
 * blink in unison. The pattern: rapid close → slower open → long pause.
 */
function sampleBlink(elapsedSeconds: number): number {
  // Create a pseudo-random interval by hashing the cycle index
  const cycleRaw = elapsedSeconds / BLINK_INTERVAL;
  const cycleIndex = Math.floor(cycleRaw);
  // Simple hash for jitter: sin of the cycle index gives ±1
  const jitter = 1 + 0.4 * Math.sin(cycleIndex * 7.31 + 2.17);
  const adjustedInterval = BLINK_INTERVAL * jitter;
  const phase = (elapsedSeconds % adjustedInterval) / adjustedInterval;
  const blinkWindow = BLINK_TOTAL / adjustedInterval;

  if (phase > blinkWindow) return 0; // eyes open (most of the time)

  const blinkProgress = phase / blinkWindow;
  const closeRatio = BLINK_CLOSE_DURATION / BLINK_TOTAL;

  if (blinkProgress < closeRatio) {
    // Closing — quick ease-in
    return blinkProgress / closeRatio;
  }
  // Opening — slightly slower ease-out
  return 1 - (blinkProgress - closeRatio) / (1 - closeRatio);
}

/* ── Micro-expressions per phase ──────────────────────────────────────── */

const PHASE_MICRO: Record<string, Partial<Record<string, number>>> = {
  welcoming: { mouthSmile_L: 0.18, mouthSmile_R: 0.18, cheekSquint_L: 0.06, cheekSquint_R: 0.06 },
  listening: { mouthSmile_L: 0.08, mouthSmile_R: 0.08, browInnerUp: 0.06 },
  thinking: { browInnerUp: 0.12, mouthPucker: 0.06 },
  speaking: { mouthSmile_L: 0.1, mouthSmile_R: 0.1 },
  error: { browDown_L: 0.12, browDown_R: 0.12, mouthFrown_L: 0.08, mouthFrown_R: 0.08 },
  editing: {},
  paused: {},
  idle: { mouthSmile_L: 0.05, mouthSmile_R: 0.05 },
};

/**
 * Merge phase micro-expressions with an optional emotion preset.
 * Emotion weights take priority (max blend) over phase defaults.
 */
function mergeMicroExpressions(
  phase: ConversationPhase,
  emotion: EmotionPreset | null
): Partial<Record<string, number>> {
  const base = PHASE_MICRO[phase] ?? {};
  if (!emotion) return base;

  const merged: Partial<Record<string, number>> = { ...base };
  for (const [key, weight] of Object.entries(emotion.morphWeights)) {
    if (weight !== undefined) {
      merged[key] = Math.max(merged[key] ?? 0, weight);
    }
  }
  return merged;
}

/* ── Speech energy coupling ──────────────────────────────────────────── */

/**
 * When speaking, adds a small nod correlated with the viseme energy.
 * `visemeEnergy` is 0-1 where 1 = wide-open mouth shape. Called by AvatarMesh
 * to modulate head motion during lip-sync.
 */
export function speechEnergyNod(visemeEnergy: number): number {
  return -0.012 * Math.min(visemeEnergy, 1);
}

/* ── Main sampler ─────────────────────────────────────────────────────── */

/** Restrained deterministic motion; jaw and visemes are intentionally absent. */
export function sampleAvatarMotion(
  phase: ConversationPhase,
  elapsedSeconds: number,
  reducedMotion: boolean,
  emotion?: EmotionPreset | null
): AvatarMotionSample {
  if (reducedMotion) return STILL;

  const breath = Math.sin(elapsedSeconds * 1.35);
  const slow = Math.sin(elapsedSeconds * 0.72);
  const emphasis = Math.sin(elapsedSeconds * 5);
  const blinkWeight = sampleBlink(elapsedSeconds);
  const microExpressions = mergeMicroExpressions(phase, emotion ?? null);

  const emotionHeadOffset = emotion?.headPitchOffset ?? 0;
  const emotionEarOffset = emotion?.earRollOffset ?? 0;

  const base = {
    rootY: breath * 0.006,
    rootScale: 1 + breath * 0.003,
    headPitch: breath * 0.008 + emotionHeadOffset,
    headYaw: slow * 0.012,
    headRoll: slow * 0.006,
    earRoll: breath * 0.01 + emotionEarOffset,
    chestPitch: breath * 0.004,
    blinkWeight,
    microExpressions,
  };

  switch (phase) {
    case 'welcoming':
      return {
        ...base,
        headPitch: -0.018 + emphasis * 0.025 + emotionHeadOffset,
        headYaw: slow * 0.035,
        earRoll: 0.025 + breath * 0.012 + emotionEarOffset,
        chestPitch: emphasis * 0.018,
      };
    case 'listening':
      return {
        ...base,
        headPitch: -0.045 + breath * 0.006 + emotionHeadOffset,
        headYaw: slow * 0.018,
        headRoll: slow * 0.005,
        earRoll: 0.035 + breath * 0.012 + emotionEarOffset,
      };
    case 'thinking':
      return {
        ...base,
        headPitch: -0.012 + breath * 0.006 + emotionHeadOffset,
        headYaw: 0.06 + slow * 0.025,
        headRoll: 0.055 + slow * 0.012,
        earRoll: 0.018 + breath * 0.008 + emotionEarOffset,
      };
    case 'speaking':
      return {
        ...base,
        rootY: breath * 0.008,
        rootScale: 1 + breath * 0.004,
        headPitch: -0.012 + emphasis * 0.035 + emotionHeadOffset,
        headYaw: slow * 0.03,
        headRoll: slow * 0.012,
        earRoll: 0.022 + breath * 0.016 + emotionEarOffset,
        chestPitch: emphasis * 0.025,
      };
    case 'error':
      return { ...base, headPitch: 0.025 + emotionHeadOffset, headRoll: -0.025 };
    case 'editing':
    case 'paused':
      return { ...base, headPitch: -0.015 + emotionHeadOffset, headYaw: slow * 0.008 };
    case 'idle':
    default:
      return base;
  }
}
