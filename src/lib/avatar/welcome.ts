import { normalizeVoiceLocale } from '@/lib/voice/catalog';

const WELCOME_BY_LANGUAGE: Readonly<Record<string, string>> = {
  en: "Hi, I'm Judy Pierre, your travel translator and guide. Ask me about your trip or say something to translate. I'll listen when I finish speaking.",
  es: 'Hola, soy Judy Pierre, tu traductora y guía de viajes. Pregúntame sobre tu viaje o dime algo que quieras traducir. Te escucharé cuando termine de hablar.',
  fr: 'Bonjour, je suis Judy Pierre, votre traductrice et guide de voyage. Parlez-moi de votre voyage ou dites-moi ce que vous voulez traduire. Je vous écouterai dès que j’aurai fini de parler.',
  de: 'Hallo, ich bin Judy Pierre, deine Übersetzerin und Reisebegleiterin. Frag mich nach deiner Reise oder sag etwas zum Übersetzen. Ich höre zu, sobald ich fertig gesprochen habe.',
  it: 'Ciao, sono Judy Pierre, la tua traduttrice e guida di viaggio. Chiedimi del tuo viaggio o dimmi qualcosa da tradurre. Ti ascolterò appena avrò finito di parlare.',
  pt: 'Olá, sou Judy Pierre, sua tradutora e guia de viagem. Pergunte sobre sua viagem ou diga algo para traduzir. Vou ouvir você quando terminar de falar.',
  ja: 'こんにちは、旅行通訳とガイドのジュディ・ピエールです。旅について質問するか、翻訳したい言葉を話してください。話し終わったら、あなたの声を聞きます。',
  ko: '안녕하세요. 여행 통역사이자 가이드인 주디 피에르예요. 여행에 관해 물어보거나 번역할 말을 해 주세요. 제가 말을 마치면 듣기 시작할게요.',
  zh: '你好，我是朱迪·皮埃尔，你的旅行翻译和向导。你可以问我旅行问题，也可以说一句需要翻译的话。我说完后就会听你说。',
  ar: 'مرحباً، أنا جودي بيير، مترجمتك ومرشدتك في السفر. اسألني عن رحلتك أو قل شيئاً تريد ترجمته. سأستمع إليك عندما أنتهي من الكلام.',
  hi: 'नमस्ते, मैं जूडी पियरे हूँ, आपकी यात्रा अनुवादक और मार्गदर्शक। अपनी यात्रा के बारे में पूछें या अनुवाद के लिए कुछ कहें। मेरे बोलने के बाद मैं आपकी बात सुनूँगी।',
  nl: 'Hallo, ik ben Judy Pierre, je reisvertaler en gids. Vraag me over je reis of zeg iets dat je wilt vertalen. Ik luister zodra ik klaar ben met praten.',
};

/** A short, local welcome so starting a conversation never waits on TTS or Hermes. */
export function localizedJudyWelcome(languageOrLocale: string | null | undefined): string {
  const locale = normalizeVoiceLocale(languageOrLocale) ?? 'en-US';
  return WELCOME_BY_LANGUAGE[locale.split('-')[0].toLowerCase()] ?? WELCOME_BY_LANGUAGE.en;
}
