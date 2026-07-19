import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  findUnique: vi.fn(),
  detectTranslationIntent: vi.fn(),
  runTravelTranslation: vi.fn(),
  runTravelKnowledge: vi.fn(),
  retrieveContext: vi.fn(),
  experiencesContextChunk: vi.fn(),
  generateContent: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: mocks.findUnique } } }));
vi.mock('@/lib/translation-intent', () => ({
  detectTranslationIntent: mocks.detectTranslationIntent,
}));
vi.mock('@/lib/hermes/translation-runner', () => ({
  runTravelTranslation: mocks.runTravelTranslation,
}));
vi.mock('@/lib/hermes/knowledge-runner', () => ({
  runTravelKnowledge: mocks.runTravelKnowledge,
}));
vi.mock('@/lib/rag/retriever', () => ({ retrieveContext: mocks.retrieveContext }));
vi.mock('@/lib/experiences/context', () => ({
  experiencesContextChunk: mocks.experiencesContextChunk,
}));
vi.mock('@/lib/gemini/config', () => ({
  configuredGeminiTextModel: () => 'gemini-3.5-flash',
  createGeminiClient: () => ({
    models: { generateContent: mocks.generateContent },
  }),
}));

import { POST } from '../route';

function jsonRequest(body: unknown) {
  return new Request('http://localhost/api/avatar/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '192.0.2.88' },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getSessionUserId.mockResolvedValue('user-a');
  mocks.findUnique.mockResolvedValue(null);
  mocks.detectTranslationIntent.mockReturnValue(null);
  mocks.retrieveContext.mockResolvedValue([]);
  mocks.experiencesContextChunk.mockReturnValue(null);
  delete process.env.GEMINI_API_KEY;
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

describe('POST /api/avatar/chat conversation history', () => {
  const history = [
    { role: 'user' as const, text: 'I am visiting Madrid.' },
    { role: 'assistant' as const, text: 'What dates are you traveling?' },
  ];

  it('grounds Gemma with bounded history while detecting translation only from the current message', async () => {
    mocks.runTravelKnowledge.mockResolvedValue('A concise Gemma answer.');

    const response = await POST(jsonRequest({ message: 'Next weekend.', history }));
    expect(response.status).toBe(200);
    expect(mocks.detectTranslationIntent).toHaveBeenCalledWith('Next weekend.', null);
    expect(mocks.runTravelKnowledge).toHaveBeenCalledWith(
      expect.any(Headers),
      'user-a',
      expect.objectContaining({
        prompt: 'Next weekend.',
        contextChunks: expect.arrayContaining([
          expect.stringContaining('Traveler: I am visiting Madrid.'),
          expect.stringContaining('Judy Pierre'),
        ]),
      }),
      8_000
    );
  });

  it('grounds the Gemini fallback with the same recent history', async () => {
    mocks.runTravelKnowledge.mockResolvedValue(null);
    mocks.generateContent.mockResolvedValue({
      text: 'A concise Gemini answer.',
    });
    process.env.GEMINI_API_KEY = 'test-key';

    const response = await POST(jsonRequest({ message: 'Next weekend.', history }));
    expect(response.status).toBe(200);
    const request = mocks.generateContent.mock.calls[0][0];
    expect(request.model).toBe('gemini-3.5-flash');
    const prompt = request.contents[0].parts[0].text;
    expect(prompt).toContain('Recent conversation:');
    expect(prompt).toContain('Traveler: I am visiting Madrid.');
    expect(prompt).toContain('User says: Next weekend.');
  });

  it('falls directly to Gemini after a bounded explicit-translation attempt', async () => {
    mocks.detectTranslationIntent.mockReturnValue({
      reason: 'explicit',
      textToTranslate: 'Where is the train station?',
      sourceLanguage: 'English',
      targetLanguage: 'Spanish',
    });
    mocks.runTravelTranslation.mockResolvedValue(null);
    mocks.runTravelKnowledge.mockResolvedValue('This path must not run.');
    mocks.generateContent.mockResolvedValue({
      text: '¿Dónde está la estación de tren?',
    });
    process.env.GEMINI_API_KEY = 'test-key';

    const response = await POST(
      jsonRequest({ message: "Translate 'Where is the train station?' into Spanish." })
    );

    expect(response.status).toBe(200);
    expect(mocks.runTravelTranslation).toHaveBeenCalledWith(
      expect.any(Headers),
      'user-a',
      expect.objectContaining({ targetLanguage: 'Spanish' }),
      8_000
    );
    expect(mocks.runTravelKnowledge).not.toHaveBeenCalled();
    expect(mocks.generateContent).toHaveBeenCalledOnce();
  });
});
