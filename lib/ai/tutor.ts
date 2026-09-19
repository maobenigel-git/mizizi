import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getLanguage } from "@/lib/db/languages";
import { listVocabulary } from "@/lib/db/vocabulary";
import type { ProficiencyLevel } from "@/types";

// AI orchestrator (docs/spec.md §1.13). The browser never talks to the model:
// /api/conversation calls this, which retrieves verified data for the learner's
// language and hands it to Claude as the only permitted linguistic source.

const MODEL = "claude-opus-5";
const MAX_TURNS = 20;

export type TutorTurn = { role: "user" | "assistant"; content: string };

export type TutorReply =
  | { status: "ok"; text: string }
  | { status: "not_configured" | "unavailable" | "declined"; message: string };

export const tutorConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

const RULES = `You are a Kenyan language tutor on Mizizi.
Never invent a translation.
Use VERIFIED_LANGUAGE_DATA as the linguistic source of truth.
Use CULTURAL_CONTEXT only when supported by cited sources.
If no verified translation exists, say plainly that the translation is unavailable ("translation_unavailable") and invite the learner to contribute it. Do not fabricate one, and do not offer a guess from your own knowledge.
Entries marked unverified may be taught, but tell the learner they are still awaiting verification.
Adapt the lesson to the learner's proficiency.
Keep replies short and conversational, in plain text without markdown. English is the language of instruction.`;

async function buildSystem(languageId: string, level: ProficiencyLevel | undefined) {
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

export async function tutorReply(
  languageId: string,
  level: ProficiencyLevel | undefined,
  history: TutorTurn[],
): Promise<TutorReply> {
  if (!tutorConfigured) {
    return { status: "not_configured", message: "The tutor is not connected yet. Set ANTHROPIC_API_KEY on the server." };
  }

  try {
    const client = new Anthropic();
    // Server-side fallback: if a safety classifier declines, the API re-runs the
    // request on a fallback model inside the same call.
    const response = await client.beta.messages.create({
      model: MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 2000,
      output_config: { effort: "low" },
      system: await buildSystem(languageId, level),
      messages: history.slice(-MAX_TURNS),
    });

    if (response.stop_reason === "refusal") {
      return { status: "declined", message: "The tutor could not help with that. Try asking about your language." };
    }
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n").trim();
    return text ? { status: "ok", text } : { status: "unavailable", message: "The tutor had nothing to say. Try again." };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { status: "not_configured", message: "The tutor's API key was rejected." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { status: "unavailable", message: "The tutor is busy. Try again in a moment." };
    }
    if (error instanceof Anthropic.APIError) {
      return { status: "unavailable", message: "The tutor is unavailable right now." };
    }
    throw error;
  }
}
