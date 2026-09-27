import "server-only";
import { ENGLISH } from "./codes";

/*
 * NLLB-200 (facebook/nllb-200-distilled-600M), Meta's many-language machine
 * translator. The reason it is here: it translates whole sentences into
 * Gikuyu and Kamba, which no other engine the app uses does.
 *
 * Where it runs. Hugging Face's serverless Inference API does not host this
 * model (its inference-provider mapping is empty, checked Sept 2026), so a
 * bare HUGGINGFACE_API_TOKEN is not enough. It needs an endpoint that serves
 * it in Hugging Face's translation format:
 *
 *   - a Hugging Face Inference Endpoint deployed from the model, or
 *   - the optional POST /translate on the MMS server (mms-server/, NLLB_MODEL set)
 *
 * Both take   { inputs, parameters: { src_lang, tgt_lang } }
 * and return  [{ translation_text }]   (the documented HF translation schema).
 *
 * Licence: the model is CC BY-NC 4.0 — non-commercial use only. Output is
 * machine translation and is labelled `machine_generated`, never verified.
 */

/**
 * Mizizi language id → FLORES-200 code, for the Kenyan languages the model
 * was trained on (each confirmed in the model's tokenizer). Nothing is mapped
 * to a "close" language: Borana is not West Central Oromo, so it's absent.
 */
export const nllbCodes: Record<string, string> = {
  [ENGLISH]: "eng_Latn",
  kiswahili: "swh_Latn",
  gikuyu: "kik_Latn",
  dholuo: "luo_Latn",
  kamba: "kam_Latn",
  somali: "som_Latn",
};

const MAX_ATTEMPTS = 4;
const ATTEMPT_TIMEOUT_MS = 10_000;
/** A user is waiting on the translate screen: give up rather than hang. */
const TOTAL_BUDGET_MS = 25_000;
const MAX_WAIT_MS = 8_000;

function config() {
  const url = process.env.NLLB_ENDPOINT_URL?.trim();
  const token = process.env.NLLB_ENDPOINT_TOKEN?.trim() || process.env.HUGGINGFACE_API_TOKEN?.trim();
  return { url, token };
}

export function nllbConfigured(): boolean {
  return Boolean(config().url);
}

export function nllbSupports(languageId: string): boolean {
  return nllbConfigured() && languageId in nllbCodes;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const normalise = (text: string) => text.trim().toLowerCase().replace(/[.!?,]+$/g, "");

/**
 * How long to wait before retrying a 429 or a 503: the server's Retry-After,
 * or a scaled-to-zero endpoint's `estimated_time` while it loads the model,
 * else exponential backoff with jitter — always capped.
 */
function waitFor(response: Response, body: { estimated_time?: number } | null, attempt: number): number {
  const retryAfter = Number(response.headers.get("retry-after"));
  const hinted = retryAfter > 0 ? retryAfter * 1000 : body?.estimated_time ? body.estimated_time * 1000 : 0;
  const backoff = 1000 * 2 ** attempt + Math.random() * 250;
  return Math.min(hinted || backoff, MAX_WAIT_MS);
}

export async function nllbTranslate(text: string, from: string, to: string): Promise<string | undefined> {
  const { url, token } = config();
  const src = nllbCodes[from];
  const tgt = nllbCodes[to];
  if (!url || !src || !tgt || from === to || !text.trim()) return undefined;

  const started = Date.now();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ inputs: text, parameters: { src_lang: src, tgt_lang: tgt } }),
        signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
      });
    } catch {
      // Timeout or network error — a cold endpoint often looks like this.
      const wait = Math.min(1000 * 2 ** attempt, MAX_WAIT_MS);
      if (Date.now() - started + wait > TOTAL_BUDGET_MS) return undefined;
      await sleep(wait);
      continue;
    }

    if (response.ok) {
      const body = (await response.json().catch(() => null)) as { translation_text?: string }[] | { translation_text?: string } | null;
      const translated = (Array.isArray(body) ? body[0] : body)?.translation_text?.trim();
      // An echo of the input is not a translation.
      return translated && normalise(translated) !== normalise(text) ? translated : undefined;
    }

    // Rate-limited, or the endpoint is still loading the model: wait and retry.
    if (response.status === 429 || response.status === 503) {
      const body = (await response.json().catch(() => null)) as { estimated_time?: number } | null;
      const wait = waitFor(response, body, attempt);
      if (Date.now() - started + wait > TOTAL_BUDGET_MS) return undefined;
      await sleep(wait);
      continue;
    }

    // Anything else (bad token, unknown language code, 5xx bug) won't fix itself.
    console.warn(`[nllb] ${response.status} from translation endpoint`);
    return undefined;
  }
  return undefined;
}
