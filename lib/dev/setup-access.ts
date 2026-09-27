import { randomBytes, timingSafeEqual } from "node:crypto";

/*
 * Who may use the local setup screen (/setup), which writes API keys to
 * .env.local:
 *
 *   - only `next dev` — in a production build the page and its actions don't
 *     exist, whatever the request;
 *   - only with the one-time token printed in the terminal when the dev
 *     server starts (instrumentation.ts), the way Jupyter does it. The dev
 *     server also answers on this machine's Wi-Fi address, so "it's only
 *     local" isn't enough on its own: without the token, someone else on the
 *     network could open the page and swap in their own keys or URLs.
 *
 * No "server-only" marker: instrumentation.ts imports this, outside the React
 * server bundle. node:crypto keeps it out of client code.
 */

export const SETUP_ENABLED = process.env.NODE_ENV === "development";

const store = globalThis as { __miziziSetupToken?: string };

/** One per dev-server process; a restart issues a new link. */
export function setupToken(): string {
  return (store.__miziziSetupToken ??= randomBytes(18).toString("base64url"));
}

export function validSetupToken(token: unknown): boolean {
  if (!SETUP_ENABLED || typeof token !== "string") return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(setupToken());
  return given.length === expected.length && timingSafeEqual(given, expected);
}
