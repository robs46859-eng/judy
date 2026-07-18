/**
 * AI photo-edit presets for Memories. Each maps to an instruction sent to the
 * Gemini image model. Brand-aligned with Judy's retro Kodak Portra aesthetic,
 * plus a few practical cleanups. Free-text prompts are also supported.
 */

export interface EditPreset {
  id: string;
  label: string;
  prompt: string;
}

export const EDIT_PRESETS: EditPreset[] = [
  {
    id: 'portra',
    label: 'Portra film',
    prompt:
      'Regrade this photo to look like it was shot on Kodak Portra 400 35mm film: warm, faded orange highlights, soft pastel-lilac shadows, gentle film grain, a subtle vignette, and a nostalgic 1970s vintage-photojournalism feel. Keep the subject and composition unchanged.',
  },
  {
    id: 'golden',
    label: 'Golden hour',
    prompt:
      'Relight this photo with warm golden-hour sunlight and a soft glow, as if taken at sunset. Keep the subject and composition unchanged.',
  },
  {
    id: 'vivid',
    label: 'Vivid & bright',
    prompt:
      'Enhance this photo with vivid but natural colors, brighter exposure, and gentle contrast so it pops for a travel album. Keep it realistic and keep the composition unchanged.',
  },
  {
    id: 'bw',
    label: 'B&W classic',
    prompt:
      'Convert this photo to a timeless high-quality black-and-white with rich tones and soft contrast. Keep the composition unchanged.',
  },
  {
    id: 'declutter',
    label: 'Clean background',
    prompt:
      'Subtly remove distracting background clutter and passers-by while keeping the main subject, setting, and composition natural and believable.',
  },
];

export function presetById(id: string): EditPreset | undefined {
  return EDIT_PRESETS.find((p) => p.id === id);
}
