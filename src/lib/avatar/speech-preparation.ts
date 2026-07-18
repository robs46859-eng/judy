import 'server-only';

import { prisma } from '@/lib/prisma';
import { runTravelTranslation } from '@/lib/hermes/translation-runner';
import {
  getTranslationLanguageName,
  languagesMatch,
  normalizeVoiceLocale,
  selectVoiceForLanguage,
} from '@/lib/voice/catalog';

/** Speech must not hold an otherwise-ready reply for the full Hermes job budget. */
export const SPEECH_TRANSLATION_BUDGET_MS = 6_000;

export interface SpeechPreparationInput {
  text: string;
  /** Language of the displayed reply when it is known (for example, a translation result). */
  replyLanguage?: string | null;
}

export interface PreparedSpeech {
  text: string;
  language: string;
  voiceId: string;
  translated: boolean;
}

/**
 * Produces the text, locale, and logical voice for audio only. The caller must
 * keep the original chat reply as the visible transcript. Failures deliberately
 * resolve to original text + a safe catalog voice, so optional translation can
 * never make Judy Pierre stop speaking.
 */
export async function prepareSpeechForUser(
  headers: Headers,
  userId: string,
  input: SpeechPreparationInput
): Promise<PreparedSpeech> {
  let savedVoiceId: string | null = null;
  let spokenLanguage: string | null = null;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { voiceId: true, spokenLanguage: true },
    });
    savedVoiceId = user?.voiceId ?? null;
    spokenLanguage = user?.spokenLanguage ?? null;
  } catch {
    // A preferences read is an enhancement, not a prerequisite for speech.
  }

  const replyLocale = normalizeVoiceLocale(input.replyLanguage);
  const targetLocale = normalizeVoiceLocale(spokenLanguage);
  let text = input.text;
  let language = replyLocale ?? 'en-US';
  let translated = false;

  // Same language, different regional locale: no translation is needed, but
  // the selected dialect should still guide the voice provider.
  if (targetLocale && languagesMatch(replyLocale, targetLocale)) {
    language = targetLocale;
  }

  // We translate when a selected speech language is not already the known
  // reply language. With no reply language hint, translation is best effort:
  // Hermes may detect the source, and its graceful null result keeps the reply.
  if (targetLocale && !languagesMatch(replyLocale, targetLocale)) {
    const targetLanguage = getTranslationLanguageName(targetLocale);
    const sourceLanguage = getTranslationLanguageName(replyLocale);
    if (targetLanguage) {
      try {
        const result = await runTravelTranslation(
          headers,
          userId,
          {
            text: input.text,
            targetLanguage,
            ...(sourceLanguage ? { sourceLanguage } : {}),
          },
          SPEECH_TRANSLATION_BUDGET_MS
        );
        if (result?.translatedText) {
          text = result.translatedText;
          language = targetLocale;
          translated = true;
        }
      } catch {
        // Preserve the existing English/default speech path when optional
        // translation cannot run; do not label untranslated text as another
        // language merely because it was selected in Settings.
      }
    }
  }

  const voice = selectVoiceForLanguage(savedVoiceId, language);
  return { text, language, voiceId: voice.id, translated };
}
