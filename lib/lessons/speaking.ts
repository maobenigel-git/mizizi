import "server-only";
import { listVocabulary } from "@/lib/db/vocabulary";
import { dictationTagFor, hasMachineVoice, speechTagFor } from "@/lib/speech/voices";
import { ENGLISH } from "@/lib/translation/codes";
import { googleSupports, googleTranslate } from "@/lib/translation/google";

/*
 * Speaking practice: a phrase is read aloud, the learner says it back, and the
 * lesson only advances once they are understood.
 *
 * What a language can actually support here is decided by Google's coverage,
 * not by us, and the three abilities come apart:
 *
 *   translation  — Kiswahili, Dholuo, Somali, Oromo
 *   a voice      — Kiswahili, English only
 *   dictation    — Kiswahili, English only
 *
 * So Kiswahili gets the full listen-and-repeat loop, and Dholuo — which Google
 * translates but neither speaks nor hears — gets the phrase and its meaning to
 * read, with no scoring. We do not substitute the Kiswahili voice for Dholuo:
 * that would teach the wrong pronunciation, which is worse than teaching none.
 */

export type SpeakingPhrase = {
  id: string;
  /** What the learner says. */
  text: string;
  /** What it means in English. */
  meaning: string;
  /** Where `text` came from, so the UI can label unverified content. */
  origin: "graph" | "google";
  verified: boolean;
};

export type SpeakingLesson = {
  languageId: string;
  phrases: SpeakingPhrase[];
  /** The machine can read the phrase aloud. */
  canSpeak: boolean;
  /** The browser can hear the learner in this language, so answers can be scored. */
  canListen: boolean;
  localeTag?: string;
  speechTag?: string;
};

/** Everyday sentences to translate when a language has no seeded phrases. */
const STARTER_SENTENCES = [
  "Good morning",
  "How are you?",
  "Thank you very much",
  "My name is Amina",
  "Where is the market?",
  "I am learning this language",
];

const MAX_PHRASES = 8;

export async function getSpeakingLesson(languageId: string): Promise<SpeakingLesson> {
  const words = await listVocabulary(languageId);

  const fromGraph: SpeakingPhrase[] = words.flatMap((w) => [
    { id: `${w.id}:term`, text: w.term, meaning: w.meaning, origin: "graph" as const, verified: w.verified },
    ...(w.example
      ? [{ id: `${w.id}:example`, text: w.example, meaning: w.exampleMeaning, origin: "graph" as const, verified: w.verified }]
      : []),
  ]);

  // Top up from Google so a language with little seeded data still has a lesson.
  const fromGoogle: SpeakingPhrase[] = [];
  if (fromGraph.length < MAX_PHRASES && googleSupports(languageId)) {
    const needed = STARTER_SENTENCES.slice(0, MAX_PHRASES - fromGraph.length);
    const translated = await Promise.all(needed.map((s) => googleTranslate(s, ENGLISH, languageId)));
    translated.forEach((text, i) => {
      if (text) {
        fromGoogle.push({ id: `google:${i}`, text, meaning: needed[i], origin: "google", verified: false });
      }
    });
  }

  return {
    languageId,
    phrases: [...fromGraph, ...fromGoogle].slice(0, MAX_PHRASES),
    canSpeak: hasMachineVoice(languageId),
    canListen: Boolean(dictationTagFor(languageId)),
    localeTag: dictationTagFor(languageId),
    speechTag: speechTagFor(languageId),
  };
}
