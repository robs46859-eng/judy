import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSessionUserId: vi.fn(),
  synthesizeSpeech: vi.fn(),
  runRhubarb: vi.fn(),
  prepareSpeechForUser: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({ getSessionUserId: mocks.getSessionUserId }));
vi.mock('@/lib/avatar/tts', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatar/tts')>('@/lib/avatar/tts');
  return { ...actual, synthesizeSpeech: mocks.synthesizeSpeech };
});
vi.mock('@/lib/avatar/rhubarb', async () => {
  const actual = await vi.importActual<typeof import('@/lib/avatar/rhubarb')>('@/lib/avatar/rhubarb');
  return { ...actual, runRhubarb: mocks.runRhubarb };
});
vi.mock('@/lib/avatar/speech-preparation', () => ({
  prepareSpeechForUser: mocks.prepareSpeechForUser,
}));

import { POST } from '../route';
import { TtsNotConfiguredError } from '@/lib/avatar/tts';
import { RhubarbUnavailableError } from '@/lib/avatar/rhubarb';

function jsonRequest(body: unknown, ip = '192.0.2.10') {
  return new Request('http://localhost/api/avatar/lipsync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  }) as NextRequest;
}

beforeEach(() => {
  mocks.getSessionUserId.mockReset();
  mocks.synthesizeSpeech.mockReset();
  mocks.runRhubarb.mockReset();
  mocks.prepareSpeechForUser.mockReset();
  mocks.prepareSpeechForUser.mockResolvedValue({
    text: 'Pack a raincoat',
    language: 'en-US',
    voiceId: 'travel-daddy-classic-en',
    translated: false,
  });
});

describe('POST /api/avatar/lipsync', () => {
  it('requires authentication', async () => {
    mocks.getSessionUserId.mockResolvedValue(null);
    const response = await POST(jsonRequest({ text: 'hello' }));
    expect(response.status).toBe(401);
    expect(mocks.synthesizeSpeech).not.toHaveBeenCalled();
  });

  it('rejects an invalid body', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    const response = await POST(jsonRequest({ text: '' }));
    expect(response.status).toBe(400);
  });

  it('returns 501 when no TTS provider is configured — a normal, expected state', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.synthesizeSpeech.mockRejectedValue(new TtsNotConfiguredError());

    const response = await POST(jsonRequest({ text: 'Pack a raincoat' }));
    expect(response.status).toBe(501);
    expect(mocks.runRhubarb).not.toHaveBeenCalled();
  });

  it('returns real audio with empty cues when Rhubarb is unavailable, instead of failing the request', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.synthesizeSpeech.mockResolvedValue({
      audio: Buffer.from('fake wav bytes'),
      mimeType: 'audio/wav',
    });
    mocks.runRhubarb.mockRejectedValue(new RhubarbUnavailableError('binary missing'));

    const response = await POST(jsonRequest({ text: 'Pack a raincoat' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cues).toEqual([]);
    expect(typeof body.audio).toBe('string');
    expect(body.audio.length).toBeGreaterThan(0);
    expect(body.spokenText).toBe('Pack a raincoat');
    expect(body.spokenLanguage).toBe('en-US');
  });

  it('returns audio and parsed cues on full success', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.synthesizeSpeech.mockResolvedValue({
      audio: Buffer.from('fake wav bytes'),
      mimeType: 'audio/wav',
    });
    mocks.runRhubarb.mockResolvedValue([{ start: 0, end: 0.1, value: 'X' }]);

    const response = await POST(jsonRequest({ text: 'Pack a raincoat' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.cues).toEqual([{ start: 0, end: 0.1, value: 'X' }]);
    expect(mocks.runRhubarb).toHaveBeenCalledWith(
      expect.stringMatching(/\.wav$/),
      { dialogFilePath: expect.stringMatching(/\.txt$/) }
    );
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'Pack a raincoat',
      language: 'en-US',
      voiceId: 'travel-daddy-classic-en',
    });
  });

  it('uses the prepared translation for both audio and Rhubarb, never the displayed reply', async () => {
    mocks.getSessionUserId.mockResolvedValue('user-a');
    mocks.prepareSpeechForUser.mockResolvedValue({
      text: 'Lleva un impermeable.',
      language: 'es-ES',
      voiceId: 'travel-daddy-classic-es',
      translated: true,
    });
    mocks.synthesizeSpeech.mockResolvedValue({ audio: Buffer.from('fake wav bytes'), mimeType: 'audio/wav' });
    mocks.runRhubarb.mockResolvedValue([]);

    const response = await POST(jsonRequest({ text: 'Pack a raincoat', language: 'en-US' }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.spokenText).toBe('Lleva un impermeable.');
    expect(body.spokenLanguage).toBe('es-ES');
    expect(mocks.synthesizeSpeech).toHaveBeenCalledWith({
      text: 'Lleva un impermeable.',
      language: 'es-ES',
      voiceId: 'travel-daddy-classic-es',
    });
  });
});
