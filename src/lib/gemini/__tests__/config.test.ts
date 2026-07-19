import { describe, expect, it } from 'vitest';
import {
  GEMINI_IMAGE_MODEL,
  GEMINI_TEXT_MODEL,
  RAG_EMBED_MODEL,
} from '../config';

describe('Gemini production model configuration', () => {
  it('uses supported production models for text, images, and embeddings', () => {
    expect(GEMINI_TEXT_MODEL).toBe('gemini-3.5-flash');
    expect(GEMINI_IMAGE_MODEL).toBe('gemini-3.1-flash-image');
    expect(RAG_EMBED_MODEL).toBe('gemini-embedding-001');
  });
});
