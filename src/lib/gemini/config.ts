import { GoogleGenAI } from '@google/genai';

export const GEMINI_TEXT_MODEL = 'gemini-3.5-flash';
export const GEMINI_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const RAG_EMBED_MODEL = 'gemini-embedding-001';
export const GEMINI_REQUEST_TIMEOUT_MS = 12_000;

export function configuredGeminiTextModel(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  return env.GEMINI_TEXT_MODEL?.trim() || GEMINI_TEXT_MODEL;
}

export function configuredGeminiImageModel(
  env: Readonly<Record<string, string | undefined>> = process.env
): string {
  return env.GEMINI_IMAGE_MODEL?.trim() || GEMINI_IMAGE_MODEL;
}

export function createGeminiClient(apiKey: string): GoogleGenAI {
  return new GoogleGenAI({
    apiKey,
    httpOptions: { timeout: GEMINI_REQUEST_TIMEOUT_MS },
  });
}
