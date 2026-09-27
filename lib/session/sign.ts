// No "server-only" marker: proxy.ts imports this too, and that bundle is not a
// React server bundle. node:crypto keeps it out of client code regardless.
import { createHmac, timingSafeEqual } from "node:crypto";

/*
 * Tamper-proofing for the session cookie.
 *
 * The cookie carries the learner's streak, XP and the userId their notes,
 * contributions and account hang off. Unsigned, anyone could hand-edit a
 * 400-day streak — or paste in someone else's userId and read their notes. So
 * the value is `payload.signature`: base64url JSON plus an HMAC-SHA256 of it.
 *
 * base64url also happens to be smaller than the URL-encoded JSON it replaces
 * (every `"`, `{` and `:` used to cost three bytes), which helps the 4KB budget
 * in ./index.
 *
 * SESSION_SECRET is required in production. Missing, every request fails with a
 * message naming the variable, rather than the app quietly running with a
 * secret anyone can read in this file. Development uses a fixed fallback so a
 * fresh checkout runs without setup.
 */

const DEV_SECRET = "mizizi-development-only-secret";

function secret(): string {
  const value = process.env.SESSION_SECRET;
  if (value && value.length >= 32) return value;
  if (process.env.NODE_ENV !== "production") return value || DEV_SECRET;
  throw new Error(
    "SESSION_SECRET must be set to a random string of at least 32 characters in production " +
      "(generate one with `openssl rand -base64 48`). See .env.example.",
  );
}

const mac = (payload: string) => createHmac("sha256", secret()).update(payload).digest("base64url");

export function sign(value: unknown): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  return `${payload}.${mac(payload)}`;
}

/** The decoded value, or undefined for anything unsigned, altered or malformed. */
export function unsign(cookie: string): unknown {
  const dot = cookie.lastIndexOf(".");
  if (dot <= 0) return undefined;
  const payload = cookie.slice(0, dot);
  const given = Buffer.from(cookie.slice(dot + 1));
  const expected = Buffer.from(mac(payload));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return undefined;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}
