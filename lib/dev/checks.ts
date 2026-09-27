import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import postgres from "postgres";
import { exchangeToken, parseServiceAccount } from "@/lib/speech/google-auth";

/*
 * "Check" on the setup screen: one cheap, real request per service, using the
 * values just saved in .env.local (passed in — the running server may not
 * have reloaded them yet). Each key is only ever sent to its own service.
 */

export type CheckResult = { ok: boolean; message: string };

const ok = (message: string): CheckResult => ({ ok: true, message });
const fail = (message: string): CheckResult => ({ ok: false, message });
const TIMEOUT = 12_000;

async function status(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT), cache: "no-store" });
}

const checks: Record<string, (env: Record<string, string>) => Promise<CheckResult>> = {
  async session(env) {
    const secret = env.SESSION_SECRET ?? "";
    if (!secret) return fail("Not set. Press Generate.");
    return secret.length >= 32 ? ok(`Set (${secret.length} characters).`) : fail(`Too short: ${secret.length} characters, needs 32+.`);
  },

  async database(env) {
    if (!env.DATABASE_URL) return fail("Not set.");
    const sql = postgres(env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 10, onnotice: () => {} });
    try {
      await sql`select 1`;
      const [row] = await sql`select to_regclass('public.schema_migrations') is not null as migrated`;
      if (!row.migrated) return ok("Connected. Tables not created yet — run npm run db:migrate.");
      const applied = await sql`select name from schema_migrations order by name`;
      return ok(`Connected. Migrations applied: ${applied.map((r) => r.name.replace(/\.sql$/, "")).join(", ") || "none"}.`);
    } catch (error) {
      return fail(`Couldn't connect: ${(error as Error).message}`);
    } finally {
      await sql.end({ timeout: 2 }).catch(() => {});
    }
  },

  async gemini(env) {
    if (!env.GEMINI_API_KEY) return fail("Not set.");
    const res = await status("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
      headers: { "x-goog-api-key": env.GEMINI_API_KEY },
    });
    return res.ok ? ok("Key accepted by Google AI Studio.") : fail(`Rejected (${res.status}). Copy the key again from AI Studio.`);
  },

  async openrouter(env) {
    if (!env.OPENROUTER_API_KEY) return fail("Not set.");
    const res = await status("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } });
    return res.ok ? ok("Key accepted by OpenRouter.") : fail(`Rejected (${res.status}).`);
  },

  async anthropic(env) {
    if (!env.ANTHROPIC_API_KEY) return fail("Not set.");
    try {
      await new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, timeout: TIMEOUT, maxRetries: 0 }).models.list({ limit: 1 });
      return ok("Key accepted by Anthropic.");
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) return fail("Rejected: the key isn't valid.");
      if (error instanceof Anthropic.PermissionDeniedError) return fail("The key has no permission — check the workspace.");
      if (error instanceof Anthropic.APIError) return fail(`Anthropic returned ${error.status}.`);
      return fail("Couldn't reach Anthropic.");
    }
  },

  async "google-speech"(env) {
    if (!env.GOOGLE_SERVICE_ACCOUNT_KEY) return fail("Not set.");
    const account = parseServiceAccount(env.GOOGLE_SERVICE_ACCOUNT_KEY);
    if (!account) return fail("That isn't a service-account key. Paste the whole downloaded .json file.");
    const project = env.GOOGLE_CLOUD_PROJECT || account.project_id;
    const region = env.GOOGLE_SPEECH_REGION || "us-central1";
    if (!["us-central1", "europe-west4"].includes(region)) return fail("Region must be us-central1 or europe-west4.");
    try {
      await exchangeToken(account);
      return ok(`Key valid for ${account.client_email} (project ${project}, ${region}). Speech itself is confirmed on first use.`);
    } catch (error) {
      return fail(`Google rejected the key: ${(error as Error).message}`);
    }
  },

  async mms(env) {
    const url = env.MMS_SERVER_URL?.replace(/\/+$/, "");
    if (!url) return fail("Not set.");
    let health: { asr_languages?: string[]; tts_languages?: string[]; translation?: boolean; device?: string };
    try {
      const res = await status(`${url}/health`);
      if (!res.ok) return fail(`The server answered ${res.status} on /health.`);
      health = await res.json();
    } catch {
      return fail("Couldn't reach the server. Is the instance running and the port exposed?");
    }
    // An empty body is a validation error (422) once past the token check, 401 before it.
    const auth = await status(`${url}/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(env.MMS_SERVER_TOKEN ? { Authorization: `Bearer ${env.MMS_SERVER_TOKEN}` } : {}) },
      body: "{}",
    }).catch(() => undefined);
    if (auth?.status === 401) return fail("Server reached, but it rejected the token. Use the MMS_SERVER_TOKEN set on the server.");
    return ok(
      `Connected (${health.device ?? "?"}). Voices: ${(health.tts_languages ?? []).join(", ") || "none"}. ` +
        `Recognition: ${(health.asr_languages ?? []).length} languages. Translation: ${health.translation ? "on" : "off"}.`,
    );
  },

  async nllb(env) {
    if (!env.NLLB_ENDPOINT_URL) return fail("Not set.");
    const token = env.NLLB_ENDPOINT_TOKEN || env.HUGGINGFACE_API_TOKEN;
    try {
      const res = await status(env.NLLB_ENDPOINT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ inputs: "Good morning", parameters: { src_lang: "eng_Latn", tgt_lang: "swh_Latn" } }),
      });
      if (res.status === 503) return ok("Endpoint found and starting up (cold start). Check again in a minute.");
      if (res.status === 401 || res.status === 403) return fail("The endpoint rejected the token.");
      if (!res.ok) return fail(`The endpoint answered ${res.status}.`);
      const body = await res.json();
      const text = (Array.isArray(body) ? body[0] : body)?.translation_text;
      return text ? ok(`Working: “Good morning” → “${text}” (Kiswahili).`) : fail("Answered, but not in the translation format.");
    } catch {
      return fail("Couldn't reach the endpoint.");
    }
  },
};

export async function runCheck(serviceId: string, env: Record<string, string>): Promise<CheckResult> {
  const check = checks[serviceId];
  if (!check) return fail("Unknown service.");
  try {
    return await check(env);
  } catch {
    return fail("The check failed unexpectedly.");
  }
}
