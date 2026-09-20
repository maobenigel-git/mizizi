import "server-only";
import { getLanguage } from "@/lib/db/languages";
import { listVocabulary } from "@/lib/db/vocabulary";
import type { ProficiencyLevel } from "@/types";

/*
 * The grounding layer every tutor provider shares (docs/spec.md §1.13).
 *
 * Retrieval and the rules live here, not in any one provider, so swapping the
 * model never changes what the tutor is allowed to say. Providers differ only
 * in how they send this system prompt.
 */

export type TutorTurn = { role: "user" | "assistant"; content: string };

export type TutorReply =
  | { status: "ok"; text: string; provider: ProviderName }
  | { status: "not_configured" | "unavailable" | "declined"; message: string };

/** Which engine answered, so the UI can label it honestly. */
export type ProviderName = "anthropic" | "gemini" | "openrouter" | "grounded";

export const providerLabels: Record<ProviderName, string> = {
  anthropic: "Claude",
  gemini: "Gemini (free tier)",
  openrouter: "OpenRouter (free model)",
  grounded: "Offline tutor",
};

export const RULES = `You are a Kenyan language tutor on Mizizi.
Never invent a translation.
Use VERIFIED_LANGUAGE_DATA as the linguistic source of truth.
Use CULTURAL_CONTEXT only when supported by cited sources.
If no verified translation exists, say plainly that the translation is unavailable ("translation_unavailable") and invite the learner to contribute it. Do not fabricate one, and do not offer a guess from your own knowledge.
Entries marked unverified may be taught, but tell the learner they are still awaiting verification.
Adapt the lesson to the learner's proficiency.
Keep replies short and conversational, in plain text without markdown. English is the language of instruction.`;

export async function buildSystem(languageId: string, level: ProficiencyLevel | undefined) {
  const [language, words] = await Promise.all([getLanguage(languageId), listVocabulary(languageId)]);
  const data = words.map((w) => ({
    term: w.term,
    meaning: w.meaning,
    example: w.example,
    example_meaning: w.exampleMeaning,
    verified: w.verified,
  }));
  return [
    RULES,
    `LEARNER: studying ${language?.name ?? languageId}, self-reported level ${level ?? "beginner"}.`,
    `VERIFIED_LANGUAGE_DATA (${language?.name ?? languageId}): ${data.length > 0 ? JSON.stringify(data) : "none loaded yet"}`,
    "CULTURAL_CONTEXT: none loaded yet",
  ].join("\n\n");
}

export const MAX_TURNS = 20;
