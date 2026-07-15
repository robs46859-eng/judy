import { describe, expect, it } from 'vitest';
import {
  HERMES_KNOWLEDGE_PROMPT_MAX_CHARS,
  HERMES_TRANSLATION_INPUT_MAX_CHARS,
  hermesCreateResponseSchema,
  hermesKnowledgeSchema,
  hermesStatusResponseSchema,
  hermesTranslationSchema,
} from '../schemas';

describe('Hermes request schemas', () => {
  it('accepts translation input exactly at the worker boundary', () => {
    expect(
      hermesTranslationSchema.safeParse({
        input: 'x'.repeat(HERMES_TRANSLATION_INPUT_MAX_CHARS),
        source_language: 'auto',
        target_language: 'es-MX',
      }).success
    ).toBe(true);
  });

  it('rejects empty, oversized, and unknown translation fields', () => {
    expect(
      hermesTranslationSchema.safeParse({ input: '', target_language: 'es' }).success
    ).toBe(false);
    expect(
      hermesTranslationSchema.safeParse({
        input: 'x'.repeat(HERMES_TRANSLATION_INPUT_MAX_CHARS + 1),
        target_language: 'es',
      }).success
    ).toBe(false);
    expect(
      hermesTranslationSchema.safeParse({
        input: 'hello',
        target_language: 'es',
        extra: true,
      }).success
    ).toBe(false);
    expect(
      hermesTranslationSchema.safeParse({ input: '   ', target_language: 'es' }).success
    ).toBe(false);
    expect(
      hermesTranslationSchema.safeParse({ input: 'é'.repeat(3_001), target_language: 'es' }).success
    ).toBe(false);
  });

  it('accepts knowledge prompts at the boundary and rejects one character over', () => {
    expect(
      hermesKnowledgeSchema.safeParse({
        prompt: 'x'.repeat(HERMES_KNOWLEDGE_PROMPT_MAX_CHARS),
        context_chunks: ['Grounded travel context.'],
      }).success
    ).toBe(true);
    expect(
      hermesKnowledgeSchema.safeParse({
        prompt: 'x'.repeat(HERMES_KNOWLEDGE_PROMPT_MAX_CHARS + 1),
        context_chunks: ['Grounded travel context.'],
      }).success
    ).toBe(false);
    expect(
      hermesKnowledgeSchema.safeParse({ prompt: 'Question', context_chunks: [] }).success
    ).toBe(false);
    expect(
      hermesKnowledgeSchema.safeParse({
        prompt: 'Question',
        context_chunks: ['é'.repeat(4_000)],
      }).success
    ).toBe(false);
  });

  it('strictly validates relay envelopes and JSON results', () => {
    expect(
      hermesCreateResponseSchema.safeParse({ job_id: 'bridge-job', status: 'queued' }).success
    ).toBe(true);
    expect(
      hermesCreateResponseSchema.safeParse({
        job_id: 'bridge-job',
        status: 'queued',
        unexpected: true,
      }).success
    ).toBe(false);
    expect(
      hermesStatusResponseSchema.safeParse({
        status: 'completed',
        result: { output: 'done', confidence: 0.9 },
        error: null,
      }).success
    ).toBe(true);
    expect(
      hermesStatusResponseSchema.safeParse({ status: 'unknown', result: null, error: null })
        .success
    ).toBe(false);
  });
});
