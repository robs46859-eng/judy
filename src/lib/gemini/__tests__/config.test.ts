import { describe, expect, it } from 'vitest';
import {
  GEMINI_IMAGE_MODEL,
  GEMINI_TEXT_MODEL,
  RAG_EMBED_MODEL,
  configuredGeminiImageModel,
  configuredGeminiTextModel,
} from '../config';

describe('Gemini production model configuration', () => {
  it('uses supported production models for text, images, and embeddings', () => {
    expect(GEMINI_TEXT_MODEL).toBe('gemini-3.5-flash');
    expect(GEMINI_IMAGE_MODEL).toBe('gemini-3.1-flash-image');
    expect(RAG_EMBED_MODEL).toBe('gemini-embedding-2');
  });

  it('accepts capability-appropriate model overrides', () => {
    expect(configuredGeminiTextModel({ GEMINI_TEXT_MODEL: 'gemini-3.5-flash-lite' })).toBe(
      'gemini-3.5-flash-lite'
    );
    expect(configuredGeminiImageModel({ GEMINI_IMAGE_MODEL: 'gemini-3.1-flash-image' })).toBe(
      'gemini-3.1-flash-image'
    );
  });

  it('falls back when an override is malformed or has the wrong capability', () => {
    expect(configuredGeminiTextModel({ GEMINI_TEXT_MODEL: '../not-a-model' })).toBe(
      GEMINI_TEXT_MODEL
    );
    expect(configuredGeminiTextModel({ GEMINI_TEXT_MODEL: 'gemini-3.1-flash-image' })).toBe(
      GEMINI_TEXT_MODEL
    );
    expect(configuredGeminiImageModel({ GEMINI_IMAGE_MODEL: 'gemini-3.5-flash' })).toBe(
      GEMINI_IMAGE_MODEL
    );
  });
});
