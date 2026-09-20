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
      session = { ...emptySession, ...JSON.parse(raw) };
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

/** Only callable from Server Actions and Route Handlers. */
export async function saveSession(session: Session): Promise<void> {
  (await cookies()).set(COOKIE_SESSION, JSON.stringify(session), cookieOptions);
}
