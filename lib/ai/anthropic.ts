import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { MAX_TURNS, type TutorReply, type TutorTurn } from "./grounding";

/*
 * The Claude provider. Kept in its own module so no other vendor's client ever
 * shares a file with the Anthropic SDK.
 *
 * Used when ANTHROPIC_API_KEY is set. Mizizi's default is the free tier in
 * lib/ai/free-model.ts; this is the paid, highest-quality option.
 */

const MODEL = "claude-opus-5";

export const anthropicConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function anthropicReply(system: string, history: TutorTurn[]): Promise<TutorReply> {
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
      system,
      messages: history.slice(-MAX_TURNS),
    });

    if (response.stop_reason === "refusal") {
      return { status: "declined", message: "The tutor could not help with that. Try asking about your language." };
    }
    const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("\n").trim();
    return text
      ? { status: "ok", text, provider: "anthropic" }
      : { status: "unavailable", message: "The tutor had nothing to say. Try again." };
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
