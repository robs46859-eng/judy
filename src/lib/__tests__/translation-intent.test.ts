import { describe, it, expect } from 'vitest';
import {
  detectExplicitTranslationIntent,
  detectScriptLanguage,
  detectScriptMismatch,
  detectTranslationIntent,
} from '../translation-intent';

describe('detectExplicitTranslationIntent', () => {
  it('matches "translate X to Y"', () => {
    const intent = detectExplicitTranslationIntent('translate good morning to Spanish');
    expect(intent).toEqual({
      textToTranslate: 'good morning',
      targetLanguage: 'Spanish',
      reason: 'explicit',
    });
  });

  it('matches "please translate X into Y"', () => {
    const intent = detectExplicitTranslationIntent('please translate thank you into French.');
    expect(intent?.textToTranslate).toBe('thank you');
    expect(intent?.targetLanguage).toBe('French');
  });

  it('matches "how do you say X in Y"', () => {
    const intent = detectExplicitTranslationIntent('how do you say where is the bathroom in Italian?');
    expect(intent).toEqual({
      textToTranslate: 'where is the bathroom',
      targetLanguage: 'Italian',
      reason: 'explicit',
    });
  });

  it('matches "what is X in Y"', () => {
    const intent = detectExplicitTranslationIntent("what's hello in Japanese");
    expect(intent?.textToTranslate).toBe('hello');
    expect(intent?.targetLanguage).toBe('Japanese');
  });

  it('returns null for ordinary conversation', () => {
    expect(detectExplicitTranslationIntent('what should I pack for Lisbon?')).toBeNull();
    expect(detectExplicitTranslationIntent('translate')).toBeNull();
    expect(detectExplicitTranslationIntent('')).toBeNull();
  });
});

describe('detectScriptLanguage', () => {
  it('identifies non-Latin scripts by Unicode range', () => {
    expect(detectScriptLanguage('こんにちは')).toBe('Japanese');
    expect(detectScriptLanguage('你好')).toBe('Chinese');
    expect(detectScriptLanguage('안녕하세요')).toBe('Korean');
    expect(detectScriptLanguage('مرحبا')).toBe('Arabic');
    expect(detectScriptLanguage('Привет')).toBe('Russian');
  });

  it('does not guess at Latin-script languages', () => {
    expect(detectScriptLanguage('Bonjour, comment ça va?')).toBeNull();
    expect(detectScriptLanguage('Hola, ¿cómo estás?')).toBeNull();
  });
});

describe('detectScriptMismatch', () => {
  it('offers a translation when the script differs from the stored native language', () => {
    const intent = detectScriptMismatch('你好，你好吗？', 'English');
    expect(intent).toEqual({
      textToTranslate: '你好，你好吗？',
      targetLanguage: 'English',
      sourceLanguage: 'Chinese',
      reason: 'script-mismatch',
    });
  });

  it('returns null when the detected script matches the native language name', () => {
    expect(detectScriptMismatch('こんにちは', 'Japanese')).toBeNull();
  });

  it('returns null with no native language on file', () => {
    expect(detectScriptMismatch('你好', null)).toBeNull();
    expect(detectScriptMismatch('你好', undefined)).toBeNull();
  });

  it('returns null for Latin-script text regardless of native language', () => {
    expect(detectScriptMismatch('Bonjour tout le monde', 'English')).toBeNull();
  });
});

describe('detectTranslationIntent', () => {
  it('prioritizes explicit intent over a script mismatch', () => {
    const intent = detectTranslationIntent('translate 你好 to English', 'English');
    expect(intent?.reason).toBe('explicit');
  });

  it('falls through to script mismatch when there is no explicit request', () => {
    const intent = detectTranslationIntent('你好，朋友！', 'English');
    expect(intent?.reason).toBe('script-mismatch');
  });

  it('returns null for ordinary English conversation from an English-native user', () => {
    expect(detectTranslationIntent('What time does the museum open?', 'English')).toBeNull();
  });
});
