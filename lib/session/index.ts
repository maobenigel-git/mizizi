import "server-only";
import { cookies } from "next/headers";
import { saveState } from "@/lib/db/accounts";
import { withMockProgress } from "./mock";
import { sign, unsign } from "./sign";
import { settleStreak, localDate } from "./streak";
import { COOKIE_SESSION, emptySession, SKIP_ONBOARDING, type Session } from "./types";

// Session state lives in a signed, httpOnly cookie (./sign). For a learner with
// an account, every save is also written to lib/db/accounts, which is what
// signing in on another device restores. The cookie stays the source of truth
// on this device, so a page render never waits on the database.
//
// Everything reads and writes through here, so the eventual move to
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
  // An unsigned, altered or corrupt cookie reads as an empty session.
  const parsed = raw ? unsign(raw) : undefined;
  if (parsed && typeof parsed === "object") session = restore(parsed);
  // With the onboarding gate skipped nothing has chosen a language, and the
  // screens behind it all key off one. Supply a development default so they
  // render as they would for a real learner.
  if (SKIP_ONBOARDING && !session.languageId) {
    // DEV_LANGUAGE picks which language the gated screens render as, so the
    // per-language differences (voice, dictation, machine translation) can be
    // checked without walking onboarding for each one.
    session = { ...session, languageId: process.env.DEV_LANGUAGE || "kiswahili", level: "beginner" };
  }
  const today = localDate();
  // Development-only sample progress, applied last so it sees the language
  // default above. A no-op unless DEV_MOCK_STREAK is on and nothing has been
  // done in this session yet — see lib/session/mock.
  session = withMockProgress(session, today);
  return { ...session, streak: settleStreak(session.streak, today) };
}

/** Fills defaults, and guards the fields render code maps over. */
export function restore(stored: object): Session {
  const session: Session = { ...emptySession, ...stored };
  if (!Array.isArray(session.notebook)) session.notebook = [];
  if (!Array.isArray(session.completedLessons)) session.completedLessons = [];
  if (!Array.isArray(session.interests)) session.interests = [];
  if (!session.activity || typeof session.activity !== "object") session.activity = {};
  if (!session.streak || typeof session.streak !== "object") session.streak = emptySession.streak;
  return session;
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

const sizeOf = (session: Session) => sign(session).length;

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
  const trimmed = trimToFit(session);
  (await cookies()).set(COOKIE_SESSION, sign(trimmed), cookieOptions);
  if (trimmed.accountId) await saveState(trimmed.accountId, trimmed);
}
