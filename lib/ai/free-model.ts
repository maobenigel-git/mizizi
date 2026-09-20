import "server-only";
import { MAX_TURNS, type ProviderName, type TutorReply, type TutorTurn } from "./grounding";

/*
 * Free-tier model providers, called over plain HTTP.
 *
 * Neither vendor has an SDK in this project and both are OpenAI-or-REST
 * shaped, so `fetch` is the whole integration. Anthropic stays in its own
 * module (lib/ai/anthropic.ts) and uses its official SDK — the two are
 * deliberately not mixed.
 *
 * Both keys are free to obtain:
 *   GEMINI_API_KEY      aistudio.google.com/apikey  — free tier, no card
 *   OPENROUTER_API_KEY  openrouter.ai/keys          — free `:free` models
 *
 * Gemini is tried first: it is the same vendor as the translation layer, and
 * its free tier is the more generous of the two.
 */

const TIMEOUT_MS = 30_000;

/** Free tier at the time of writing; both are chosen for cost, not capability. */
const GEMINI_MODEL = "gemini-2.0-flash";
const OPENROUTER_MODEL = "meta-llama/llama-3.3-70b-instruct:free";

export function freeProviderConfigured(): ProviderName | undefined {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return undefined;
}

/** Undefined means "no free provider configured"; callers fall through. */
export async function freeModelReply(system: string, history: TutorTurn[]): Promise<TutorReply | undefined> {
  const provider = freeProviderConfigured();
  if (provider === "gemini") return gemini(system, history);
  if (provider === "openrouter") return openRouter(system, history);
  return undefined;
}

const unavailable = (message: string): TutorReply => ({ status: "unavailable", message });

async function gemini(system: string, history: TutorTurn[]): Promise<TutorReply> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        // Gemini calls the assistant role "model".
        contents: history.slice(-MAX_TURNS).map((turn) => ({
          role: turn.role === "assistant" ? "model" : "user",
          parts: [{ text: turn.content }],
        })),
        generationConfig: { maxOutputTokens: 800, temperature: 0.4 },
      }),
    });

    if (response.status === 401 || response.status === 403) {
      return { status: "not_configured", message: "The tutor's Gemini API key was rejected." };
    }
    if (response.status === 429) return unavailable("The tutor has hit its free-tier limit. Try again shortly.");
    if (!response.ok) return unavailable("The tutor is unavailable right now.");

    const body = await response.json();
    const candidate = body?.candidates?.[0];
    // SAFETY / PROHIBITED_CONTENT means the model declined, not that it broke.
    if (candidate?.finishReason === "SAFETY" || candidate?.finishReason === "PROHIBITED_CONTENT") {
      return { status: "declined", message: "The tutor could not help with that. Try asking about your language." };
    }
    const text = (candidate?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? "")
      .join("")
      .trim();
    return text ? { status: "ok", text, provider: "gemini" } : unavailable("The tutor had nothing to say. Try again.");
  } catch {
    return unavailable("Could not reach the tutor's model provider.");
  }
}

async function openRouter(system: string, history: TutorTurn[]): Promise<TutorReply> {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY!}`,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 800,
        temperature: 0.4,
        messages: [{ role: "system", content: system }, ...history.slice(-MAX_TURNS)],
      }),
    });

    if (response.status === 401) {
      return { status: "not_configured", message: "The tutor's OpenRouter API key was rejected." };
    }
    if (response.status === 429) return unavailable("The tutor has hit its free-tier limit. Try again shortly.");
    if (!response.ok) return unavailable("The tutor is unavailable right now.");

    const body = await response.json();
    const text = (body?.choices?.[0]?.message?.content ?? "").trim();
    return text ? { status: "ok", text, provider: "openrouter" } : unavailable("The tutor had nothing to say. Try again.");
  } catch {
    return unavailable("Could not reach the tutor's model provider.");
  }
}
