import { ENGLISH } from "@/lib/translation/codes";

/*
 * Which languages have a voice, and which have dictation.
 *
 * Three separate tables, because the three engines cover different ground and
 * conflating them is how you end up reading Dholuo aloud in an English accent:
 *
 *   ttsVoices      — Google Translate TTS, proxied by /api/speech.
 *   deviceVoices   — the browser's own speechSynthesis, used when Google has none.
 *   dictationTags  — the Web Speech API, which runs in the browser.
 *
 * All three were checked against the live services. Every lookup returns
 * undefined for a language that is absent, and every caller treats undefined as
 * "say there is no voice" rather than substituting a neighbouring language.
 */

/** Mizizi language id → Google TTS code. Only these two return audio. */
const ttsVoices: Record<string, string> = {
  [ENGLISH]: "en",
  kiswahili: "sw",
};

export function ttsCodeFor(languageId: string): string | undefined {
  return ttsVoices[languageId];
}

/**
 * BCP-47 tag for the device's own synthesiser, used only when Google has no
 * voice. Deliberately the same short list: a device that has no Kiswahili voice
 * should stay silent rather than read Kiswahili in English.
 */
const deviceVoices: Record<string, string> = {
  [ENGLISH]: "en-KE",
  kiswahili: "sw-KE",
};

export function speechTagFor(languageId: string | undefined): string | undefined {
  return languageId ? deviceVoices[languageId] : undefined;
}

/** Mizizi language id → BCP-47 tag for browser dictation. */
const dictationTags: Record<string, string> = {
  [ENGLISH]: "en-KE",
  kiswahili: "sw-KE",
};

/** Undefined where there is no dictation locale, so the mic can be hidden. */
export function dictationTagFor(languageId: string | undefined): string | undefined {
  return languageId ? dictationTags[languageId] : undefined;
}

export function hasMachineVoice(languageId: string): boolean {
  return languageId in ttsVoices || languageId in deviceVoices;
}
