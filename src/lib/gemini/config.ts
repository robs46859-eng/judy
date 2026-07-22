import { GoogleGenAI } from '@google/genai';

export const GEMINI_TEXT_MODEL = 'gemini-3.5-flash';
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const RAG_EMBED_MODEL = 'gemini-embedding-2';
export const GEMINI_REQUEST_TIMEOUT_MS = 12_000;

const GEMINI_MODEL_ID = /^gemini-[a-z0-9][a-z0-9.-]{2,94}$/;

function validModelOverride(value: string | undefined, capability: 'text' | 'image'): string | null {
  const candidate = value?.trim();
  if (!candidate || !GEMINI_MODEL_ID.test(candidate)) return null;
  if (capability === 'image') return candidate.includes('image') ? candidate : null;
  return candidate.includes('image') || candidate.includes('embedding') ? null : candidate;
}

export function configuredGeminiTextModel(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  return validModelOverride(env.GEMINI_TEXT_MODEL, 'text') ?? GEMINI_TEXT_MODEL;
}

export function configuredGeminiImageModel(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  return validModelOverride(env.GEMINI_IMAGE_MODEL, 'image') ?? GEMINI_IMAGE_MODEL;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
  });
}
