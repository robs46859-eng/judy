import { describe, expect, it } from 'vitest';
import { selectBrowserVoice } from '../browserVoice';

describe('selectBrowserVoice', () => {
  const voices = [
    { name: 'Generic', lang: 'en-US', default: true },
    { name: 'Samantha Enhanced', lang: 'en-US', localService: true },
    { name: 'Google español', lang: 'es-ES' },
  ];

  it('prefers a natural exact-locale voice over the generic default', () => {
    expect(selectBrowserVoice(voices, 'en-US')?.name).toBe('Samantha Enhanced');
  });

  it('keeps language compatibility ahead of name preference', () => {
    expect(selectBrowserVoice(voices, 'es-MX')?.name).toBe('Google español');
  });

  it('returns null when the device exposes no voices', () => {
    expect(selectBrowserVoice([], 'en-US')).toBeNull();
  });
});
