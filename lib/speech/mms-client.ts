import "server-only";
import type { Recognition, RecognitionError } from "./recognition";

/*
 * Client for the self-hosted MMS speech server (mms-server/, on a GPU
 * instance). Server-side only: MMS_SERVER_TOKEN must never reach a browser.
 *
 *   MMS_SERVER_URL    e.g. https://mms.example.dev (no trailing slash needed)
 *   MMS_SERVER_TOKEN  the server's shared secret (Authorization: Bearer)
 *
 * Which languages it serves is asked of the server (GET /health), not
 * hard-coded here: the server decides which voices to load. The answer is
 * cached, and an unreachable server — a stopped GPU instance is normal —
 * counts as serving nothing, so every caller falls back instead of failing.
 *
 * Languages are addressed by ISO 639-3 (the registry's `iso639_3`), which is
 * what MMS uses.
 */

type Capabilities = { asr: Set<string>; tts: Set<string> };

const HEALTH_TTL_MS = 5 * 60_000;
/** Re-check a down server sooner, so it's picked up soon after it starts. */
const DOWN_TTL_MS = 30_000;
const HEALTH_TIMEOUT_MS = 3_000;
const TRANSCRIBE_TIMEOUT_MS = 20_000;
const SYNTHESIZE_TIMEOUT_MS = 15_000;

const NONE: Capabilities = { asr: new Set(), tts: new Set() };
let cache: { at: number; ttl: number; value: Capabilities } | undefined;
let inflight: Promise<Capabilities> | undefined;

function config() {
  const url = process.env.MMS_SERVER_URL?.trim().replace(/\/+$/, "");
  const token = process.env.MMS_SERVER_TOKEN?.trim();
  return { url, headers: token ? { Authorization: `Bearer ${token}` } : ({} as Record<string, string>) };
}

export function mmsConfigured(): boolean {
  return Boolean(config().url);
}

export async function mmsCapabilities(): Promise<Capabilities> {
  const { url } = config();
  if (!url) return NONE;
  if (cache && Date.now() - cache.at < cache.ttl) return cache.value;
  // Many requests can ask at once (a page render); share one health check.
  inflight ??= (async () => {
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS), cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { asr_languages?: string[]; tts_languages?: string[] };
      const value = { asr: new Set(body.asr_languages ?? []), tts: new Set(body.tts_languages ?? []) };
      cache = { at: Date.now(), ttl: HEALTH_TTL_MS, value };
      return value;
    } catch {
      cache = { at: Date.now(), ttl: DOWN_TTL_MS, value: NONE };
      return NONE;
    } finally {
      inflight = undefined;
    }
  })();
  return inflight;
}

/** POST /transcribe: the recording (WAV from the browser) → words with confidence. */
export async function mmsTranscribe(audio: Buffer, iso: string): Promise<Recognition | RecognitionError> {
  const { url, headers } = config();
  if (!url) return { error: "not_configured" };

  const form = new FormData();
  form.set("audio", new Blob([new Uint8Array(audio)], { type: "audio/wav" }), "attempt.wav");
  form.set("language", iso);

  let res: Response;
  try {
    res = await fetch(`${url}/transcribe`, { method: "POST", headers, body: form, signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS) });
  } catch {
    cache = undefined; // it may have gone away; re-check before relying on it again
    return { error: "unavailable" };
  }
  if (res.status === 401 || res.status === 403) {
    console.warn("[mms] the speech server rejected MMS_SERVER_TOKEN");
    return { error: "not_configured" };
  }
  if (res.status === 429 || res.status === 503) return { error: "busy" };
  if (!res.ok) return { error: "unavailable" };

  const body = (await res.json()) as { transcript?: string; words?: { word: string; confidence?: number }[] };
  return { transcript: (body.transcript ?? "").trim(), words: body.words ?? [], provider: "mms" };
}

/** POST /synthesize: text → WAV bytes, or undefined when there is no voice or no server. */
export async function mmsSynthesize(text: string, iso: string): Promise<ArrayBuffer | undefined> {
  const { url, headers } = config();
  if (!url || !(await mmsCapabilities()).tts.has(iso)) return undefined;
  try {
    const res = await fetch(`${url}/synthesize`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ text, language: iso }),
      signal: AbortSignal.timeout(SYNTHESIZE_TIMEOUT_MS),
    });
    if (!res.ok || !res.headers.get("content-type")?.startsWith("audio/")) return undefined;
    return await res.arrayBuffer();
  } catch {
    return undefined;
  }
}
