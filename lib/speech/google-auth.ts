import "server-only";
import { createSign } from "node:crypto";

/*
 * An OAuth access token for a Google Cloud service account, via the standard
 * JWT-bearer grant: sign a short-lived JWT with the account's private key and
 * exchange it at oauth2.googleapis.com/token. No SDK needed for one POST, and
 * nothing here ever reaches the browser.
 *
 * GOOGLE_SERVICE_ACCOUNT_KEY holds the JSON key file Google issues, either as
 * raw JSON or base64-encoded (easier to paste into a hosting dashboard).
 */

export type ServiceAccount = { client_email: string; private_key: string; project_id?: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

let cached: { token: string; expiresAt: number } | undefined;

export function serviceAccount(): ServiceAccount | undefined {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY?.trim();
  return raw ? parseServiceAccount(raw) : undefined;
}

const b64url = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** Parses a key as GOOGLE_SERVICE_ACCOUNT_KEY holds it: raw JSON or base64 of it. */
export function parseServiceAccount(raw: string): ServiceAccount | undefined {
  try {
    const text = raw.trim();
    const key = JSON.parse(text.startsWith("{") ? text : Buffer.from(text, "base64").toString("utf8"));
    return typeof key.client_email === "string" && typeof key.private_key === "string" ? key : undefined;
  } catch {
    return undefined;
  }
}

/** One JWT-bearer exchange for a given account. Throws with Google's reason on failure. */
export async function exchangeToken(account: ServiceAccount): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64url({ alg: "RS256", typ: "JWT" })}.${b64url({
    iss: account.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(account.private_key, "base64url");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!response.ok || !body.access_token) {
    throw new Error(body.error_description ?? `Google token exchange failed (${response.status})`);
  }
  return { token: body.access_token, expiresIn: body.expires_in ?? 3600 };
}

export async function googleAccessToken(): Promise<string> {
  // Refresh a minute early so a token never expires mid-request.
  if (cached && cached.expiresAt - 60_000 > Date.now()) return cached.token;
  const account = serviceAccount();
  if (!account) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing or not a service-account key");
  const { token, expiresIn } = await exchangeToken(account);
  cached = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}
