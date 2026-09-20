import "server-only";
import { cookies } from "next/headers";
import { settleStreak, localDate } from "./streak";
import { COOKIE_SESSION, emptySession, SKIP_ONBOARDING, type Session } from "./types";

// Session state lives in an httpOnly cookie until auth + Postgres are wired up.
// Everything reads and writes through here, so the swap to `onboarding_profiles`,
// `user_streaks`, `user_progress` etc. stays inside this folder.

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

export async function getSession(): Promise<Session> {
  const raw = (await cookies()).get(COOKIE_SESSION)?.value;
  let session = emptySession;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      session = { ...emptySession, ...parsed };
      // A hand-edited or truncated cookie must not make .map() throw on render.
      if (!Array.isArray(session.notebook)) session.notebook = [];
    } catch {
      // corrupt cookie: fall back to an empty session
    }
  }
  // With the onboarding gate skipped nothing has chosen a language, and the
  // screens behind it all key off one. Supply a development default so they
  // render as they would for a real learner.
  if (SKIP_ONBOARDING && !session.languageId) {
    // DEV_LANGUAGE picks which language the gated screens render as, so the
    // per-language differences (voice, dictation, machine translation) can be
    // checked without walking onboarding for each one.
    session = { ...session, languageId: process.env.DEV_LANGUAGE || "kiswahili", level: "beginner" };
  }
  return { ...session, streak: settleStreak(session.streak, localDate()) };
}

/*
 * Browsers cap a cookie at about 4KB and drop anything larger without telling
 * anyone — the write "succeeds" and the session silently reverts on the next
 * read, losing the streak with it.
 *
 * This is reachable today: NOTEBOOK_LIMIT is 40 and one entry costs ~135 bytes
 * encoded, so a full notebook is ~5.9KB on its own. So the session is trimmed
 * before it is written — oldest notebook entries first, then the oldest
 * activity days, both being the least valuable data we hold.
 */
const COOKIE_BUDGET = 3500;

const sizeOf = (session: Session) => Buffer.byteLength(encodeURIComponent(JSON.stringify(session)), "utf8");

export function trimToFit(session: Session): Session {
  let trimmed = session;
  // Oldest first, and never drop the last of anything: a session that cannot
  // fit even when empty is a bug worth seeing rather than silently papering over.
  while (sizeOf(trimmed) > COOKIE_BUDGET && trimmed.notebook.length > 1) {
    trimmed = { ...trimmed, notebook: trimmed.notebook.slice(1) };
  }
  while (sizeOf(trimmed) > COOKIE_BUDGET && Object.keys(trimmed.activity).length > 1) {
    const [oldest] = Object.keys(trimmed.activity).sort();
    const activity = { ...trimmed.activity };
    delete activity[oldest];
    trimmed = { ...trimmed, activity };
  }
  return trimmed;
}

/** Only callable from Server Actions and Route Handlers. */
export async function saveSession(session: Session): Promise<void> {
  (await cookies()).set(COOKIE_SESSION, JSON.stringify(trimToFit(session)), cookieOptions);
}
