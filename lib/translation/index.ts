import { listVocabulary } from "@/lib/db/vocabulary";
import type { ConfidenceTier } from "@/types";
import { ENGLISH } from "./codes";
import { googleSupports, googleTranslate } from "./google";
import { WIKTIONARY_LICENSE, wiktionarySupports, wiktionaryTranslate } from "./wiktionary";

// Translation over the shared-concept graph (docs/spec.md §1.8): a term resolves
// to a concept, and the concept to the target language directly — no pivot
// through English. The graph is always consulted first and always wins.
//
// Where the graph has nothing, two outside sources are asked in turn, each
// entering at a tier that reflects what it actually is:
//
//   Wiktionary  human-edited, cited, CC BY-SA -> `corpus_supported`
//               single English words only, but reaches twenty-odd languages
//   Google      machine output -> `machine_generated`
//               four languages, but handles whole sentences
//
// Wiktionary goes first because a curated dictionary entry beats machine
// output. Neither is ever promoted to a verified translation, both carry an
// `engine` so the UI can attribute them, and when nobody has an answer the
// result stays `not_available` rather than becoming a guess.

export { ENGLISH };

export const confidenceLabels: Record<ConfidenceTier, string> = {
  verified: "Verified",
  community_verified: "Community verified",
  corpus_supported: "Corpus supported",
  machine_generated: "Machine generated",
  ai_suggested: "AI suggested",
  not_available: "Not available",
};

export type TranslationResult = {
  query: string;
  from: string;
  to: string;
  conceptId?: string;
  text?: string;
  confidence: ConfidenceTier;
  example?: { text: string; meaning: string };
  /** Which system produced `text`. Absent when there is no translation. */
  engine?: "graph" | "wiktionary" | "google";
  /** Licence that must be shown with `text`, where the source requires one. */
  license?: string;
};

const normalise = (text: string) => text.trim().toLowerCase().replace(/[.!?,]+$/g, "");

export async function translate(query: string, from: string, to: string): Promise<TranslationResult> {
  const words = await listVocabulary();
  const needle = normalise(query);
  const miss: TranslationResult = { query, from, to, confidence: "not_available" };
  if (!needle || from === to) return miss;

  const source = words.find((w) =>
    from === ENGLISH ? normalise(w.meaning) === needle : w.languageId === from && normalise(w.term) === needle,
  );
  if (!source) return machineFallback(query, from, to, miss);

  if (to === ENGLISH) {
    return { ...miss, conceptId: source.conceptId, text: source.meaning, confidence: tierOf(source.verified), engine: "graph" };
  }
  const target = words.find((w) => w.conceptId === source.conceptId && w.languageId === to);
  // The concept is known but this language has no term for it yet.
  if (!target) return machineFallback(query, from, to, { ...miss, conceptId: source.conceptId });

  return {
    ...miss,
    conceptId: target.conceptId,
    text: target.term,
    confidence: tierOf(target.verified && source.verified),
    ...(target.example && target.exampleMeaning
      ? { example: { text: target.example, meaning: target.exampleMeaning } }
      : {}),
    engine: "graph",
  };
}

/** Asked only after the graph comes up empty. Returns `miss` unchanged on failure. */
async function machineFallback(
  query: string,
  from: string,
  to: string,
  miss: TranslationResult,
): Promise<TranslationResult> {
  const curated = await wiktionaryTranslate(query, from, to);
  if (curated) {
    return { ...miss, text: curated, confidence: "corpus_supported", engine: "wiktionary", license: WIKTIONARY_LICENSE };
  }
  const machine = await googleTranslate(query, from, to);
  return machine ? { ...miss, text: machine, confidence: "machine_generated", engine: "google" } : miss;
}

/** True when any outside source covers the pair, so the UI can say why it is empty. */
export function machineTranslationAvailable(from: string, to: string): boolean {
  return (googleSupports(from) && googleSupports(to)) || wiktionarySupports(to);
}

/** Every language an outside source can translate into, for the UI to badge. */
export function outsideSourcesFor(languageId: string): ("wiktionary" | "google")[] {
  const sources: ("wiktionary" | "google")[] = [];
  if (wiktionarySupports(languageId)) sources.push("wiktionary");
  if (googleSupports(languageId)) sources.push("google");
  return sources;
}

/** Seed entries were drafted by an AI and not yet checked, so they rank lowest. */
function tierOf(verified: boolean): ConfidenceTier {
  return verified ? "verified" : "ai_suggested";
}
