import "server-only";
import { listVocabulary } from "@/lib/db/vocabulary";
import { dictationTagFor, hasMachineVoice, speechTagFor } from "@/lib/speech/voices";
import { ENGLISH } from "@/lib/translation/codes";
import { googleSupports, googleTranslate } from "@/lib/translation/google";
import { wiktionarySupports, wiktionaryTranslate } from "@/lib/translation/wiktionary";

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
  origin: "graph" | "wiktionary" | "google";
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

/*
 * Single words for the eighteen languages Wiktionary covers but Google does
 * not. Without these, every one of them would open the lesson on "no phrases
 * to practise" — a dictionary word is a worse lesson than a sentence, and a
 * far better one than an empty screen.
 */
const STARTER_WORDS = ["water", "fire", "food", "mother", "house", "tree", "sun", "name", "moon", "child"];

const MAX_PHRASES = 8;

export async function getSpeakingLesson(languageId: string): Promise<SpeakingLesson> {
  const words = await listVocabulary(languageId);

  const fromGraph: SpeakingPhrase[] = words.flatMap((w) => [
    { id: `${w.id}:term`, text: w.term, meaning: w.meaning, origin: "graph" as const, verified: w.verified },
    // Both halves or neither: an example with no gloss teaches nothing.
    ...(w.example && w.exampleMeaning
      ? [{ id: `${w.id}:example`, text: w.example, meaning: w.exampleMeaning, origin: "graph" as const, verified: w.verified }]
      : []),
  ]);

  // Top up from outside sources so a language with little seeded data still has
  // a lesson. Both lookups fan out in parallel — a lesson is built on every
  // page load, so doing these in series would be the slowest thing on the screen.
  const topUp: SpeakingPhrase[] = [];
  const shortfall = MAX_PHRASES - fromGraph.length;

  if (shortfall > 0 && googleSupports(languageId)) {
    const wanted = STARTER_SENTENCES.slice(0, shortfall);
    const translated = await Promise.all(wanted.map((s) => googleTranslate(s, ENGLISH, languageId)));
    translated.forEach((text, i) => {
      if (text) topUp.push({ id: `google:${i}`, text, meaning: wanted[i], origin: "google", verified: false });
    });
  }

  if (topUp.length < shortfall && wiktionarySupports(languageId)) {
    const wanted = STARTER_WORDS.slice(0, shortfall - topUp.length);
    const translated = await Promise.all(wanted.map((w) => wiktionaryTranslate(w, ENGLISH, languageId)));
    translated.forEach((text, i) => {
      if (text) topUp.push({ id: `wiktionary:${i}`, text, meaning: wanted[i], origin: "wiktionary", verified: false });
    });
  }

  return {
    languageId,
    phrases: [...fromGraph, ...topUp].slice(0, MAX_PHRASES),
    canSpeak: hasMachineVoice(languageId),
    canListen: Boolean(dictationTagFor(languageId)),
    localeTag: dictationTagFor(languageId),
    speechTag: speechTagFor(languageId),
  };
}
