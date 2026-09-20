import "server-only";
import type { ProficiencyLevel } from "@/types";
import { anthropicConfigured, anthropicReply } from "./anthropic";
import { freeModelReply, freeProviderConfigured } from "./free-model";
import { groundedReply } from "./grounded";
import { buildSystem, type ProviderName, type TutorReply, type TutorTurn } from "./grounding";

/*
 * AI orchestrator (docs/spec.md §1.13). The browser never talks to a model:
 * /api/conversation calls this, which retrieves verified data for the learner's
 * language and hands it to a provider as the only permitted linguistic source.
 *
 * Providers are tried in order of quality, and the last one needs no key at
 * all, so the Tutor tab always works:
 *
 *   1. Anthropic     ANTHROPIC_API_KEY                  (paid, best)
 *   2. Free tier     GEMINI_API_KEY / OPENROUTER_API_KEY (free key, good)
 *   3. Grounded      nothing                             (no model, lookup only)
 *
 * Whichever answers is named in the reply so the UI can say which engine the
 * learner is talking to.
 */

export type { TutorTurn, TutorReply, ProviderName } from "./grounding";
export { providerLabels } from "./grounding";

/** Which provider a request would use right now. Never undefined — (3) always applies. */
export function activeProvider(): ProviderName {
  if (anthropicConfigured) return "anthropic";
  return freeProviderConfigured() ?? "grounded";
}

/** True when a real model is behind the tutor, rather than the lookup fallback. */
export const tutorConfigured = activeProvider() !== "grounded";

export async function tutorReply(
  languageId: string,
  level: ProficiencyLevel | undefined,
  history: TutorTurn[],
): Promise<TutorReply> {
  const provider = activeProvider();
  if (provider === "grounded") return groundedReply(languageId, history);

  const system = await buildSystem(languageId, level);
  const reply = provider === "anthropic" ? await anthropicReply(system, history) : await freeModelReply(system, history);

  // A configured provider that failed still leaves the learner with a tutor:
  // fall back to lookup rather than showing an error and nothing else.
  if (!reply || reply.status === "unavailable" || reply.status === "not_configured") {
    const fallback = await groundedReply(languageId, history);
    if (fallback.status === "ok") {
      return { ...fallback, text: `(${reply?.message ?? "The model is unavailable."} Answering from checked data instead.)\n\n${fallback.text}` };
    }
  }
  return reply ?? { status: "unavailable", message: "The tutor is unavailable right now." };
}
