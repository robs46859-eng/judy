import type { ConversationPhase } from '@/components/avatar/conversationMachine';

export interface AvatarWeatherContext {
  temperatureF?: number | null;
  condition?: string | null;
}

export type WeatherGesture = 'cold' | 'hot' | 'comfortable';
export type AvatarGesture = 'idle' | 'wave' | 'listen' | 'think' | 'talk' | 'shiver' | 'fan' | 'walk';

export interface AvatarBehavior {
  animationName: string;
  gesture: AvatarGesture;
  walking: boolean;
}

const COLD_CONDITION = /\b(cold|freez|frost|ice|icy|sleet|snow|blizzard)\b/i;
const HOT_CONDITION = /\b(hot|heat|scorch|swelter)\b/i;

/** Convert live trip weather into one restrained body-language cue. */
export function classifyAvatarWeather(weather?: AvatarWeatherContext | null): WeatherGesture {
  const condition = weather?.condition?.trim() ?? '';
  if (COLD_CONDITION.test(condition) || (weather?.temperatureF ?? Infinity) <= 45) return 'cold';
  if (HOT_CONDITION.test(condition) || (weather?.temperatureF ?? -Infinity) >= 82) return 'hot';
  return 'comfortable';
}

/** Judy takes one short, in-place walk around the platform every 24 seconds. */
export function isPlatformWalkWindow(elapsedSeconds: number): boolean {
  const cycle = ((elapsedSeconds % 24) + 24) % 24;
  return cycle >= 14 && cycle < 20;
}

export interface PlatformWalkPose {
  x: number;
  z: number;
  yaw: number;
}

/**
 * A small figure-eight path that begins and ends at platform center. The
 * authored clip remains in-place, so Judy never walks off the plinth.
 */
export function samplePlatformWalk(elapsedSeconds: number): PlatformWalkPose {
  if (!isPlatformWalkWindow(elapsedSeconds)) return { x: 0, z: 0, yaw: 0 };
  const progress = (elapsedSeconds % 24 - 14) / 6;
  const angle = progress * Math.PI * 2;
  const x = Math.sin(angle) * 0.2;
  const z = Math.sin(angle * 2) * 0.055;
  const dx = Math.cos(angle) * 0.2;
  const dz = Math.cos(angle * 2) * 0.11;
  return { x, z, yaw: Math.atan2(dx, dz) };
}

export function selectAvatarBehavior(input: {
  phase: ConversationPhase;
  talking: boolean;
  elapsedSeconds: number;
  emotionName?: string | null;
  weather?: AvatarWeatherContext | null;
  reducedMotion?: boolean;
}): AvatarBehavior {
  if (input.reducedMotion) {
    return { animationName: 'Idle', gesture: 'idle', walking: false };
  }

  if (input.talking || input.phase === 'speaking') {
    return {
      animationName: input.emotionName === 'excited' ? 'Fidget_WeightShift' : 'Idle',
      gesture: 'talk',
      walking: false,
    };
  }

  if (input.phase === 'welcoming') {
    return { animationName: 'Judy_Wave', gesture: 'wave', walking: false };
  }

  if (input.phase === 'listening') {
    return { animationName: 'Idle', gesture: 'listen', walking: false };
  }

  if (input.phase === 'thinking') {
    return { animationName: 'Fidget_LookAround', gesture: 'think', walking: false };
  }

  const weather = classifyAvatarWeather(input.weather);
  if (weather === 'cold') {
    return { animationName: 'Judy_Shiver', gesture: 'shiver', walking: false };
  }
  if (weather === 'hot') {
    return { animationName: 'Judy_CoolDown', gesture: 'fan', walking: false };
  }

  if (input.phase === 'idle' && isPlatformWalkWindow(input.elapsedSeconds)) {
    return { animationName: 'Walk_Forward_InPlace', gesture: 'walk', walking: true };
  }

  return { animationName: 'Idle', gesture: 'idle', walking: false };
}
