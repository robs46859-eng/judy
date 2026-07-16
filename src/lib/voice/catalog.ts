/**
 * Server-approved voice catalog (Swarm J5).
 *
 * The client may only ever pick from this list — never an arbitrary
 * provider voice ID. `PATCH /api/user/preferences` validates against
 * `APPROVED_VOICE_IDS` via zod, so a request naming anything else is
 * rejected outright, the same way unknown preference fields are.
 *
 * NOTE: these IDs are placeholders. Replace them with the real HeyGen voice
 * IDs from your account's voice catalog before wiring this up against a
 * live HeyGen session — ship this file as-is and every `voiceId` written
 * here will simply never match anything HeyGen recognizes.
 */

export interface VoiceOption {
  id: string;
  label: string;
  language: string;
}

export const APPROVED_VOICES: readonly VoiceOption[] = [
  { id: 'travel-daddy-classic-en', label: 'Classic (English)', language: 'English' },
  { id: 'travel-daddy-warm-en', label: 'Warm (English)', language: 'English' },
  { id: 'travel-daddy-classic-es', label: 'Clásico (Español)', language: 'Spanish' },
] as const;

export const APPROVED_VOICE_IDS: readonly string[] = APPROVED_VOICES.map((v) => v.id);

export function isApprovedVoiceId(voiceId: string): boolean {
  return APPROVED_VOICE_IDS.includes(voiceId);
}

export function getVoiceOption(voiceId: string | null | undefined): VoiceOption | null {
  if (!voiceId) return null;
  return APPROVED_VOICES.find((v) => v.id === voiceId) ?? null;
}
