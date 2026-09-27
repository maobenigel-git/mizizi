import { seedWords } from "@/data/seed/word-of-day";
import { addDays } from "./streak";
import type { Session } from "./types";

/*
 * Development-only sample progress.
 *
 * A fresh session is empty, which means the streak flame, the week strip, the
 * daily goal and the notebook all render their zero state and there is nothing
 * to look at while working on them. This fills them in.
 *
 * Switched on by DEV_MOCK_STREAK=true, and — like DEV_SKIP_ONBOARDING — only
 * honoured in development. `next build` pins NODE_ENV to "production", so it
 * cannot be switched on in a deployed build.
 *
 * Two deliberate choices:
 *
 *  - The last active day is *yesterday*, not today. A streak that already
 *    counts today cannot be extended again (one increment per calendar day),
 *    so finishing a lesson would appear to do nothing. Ending yesterday means
 *    the first lesson completed takes 5 days to 6 in front of you, which is
 *    the behaviour worth being able to see.
 *
 *  - It is applied only to a session that has no history of its own, and
 *    getSession() hands the result to the server actions, so the first real
 *    lesson writes the sample baseline into the cookie and it stops being
 *    re-applied. Nothing overwrites progress the learner actually made.
 */

export const MOCK_ENABLED =
  process.env.NODE_ENV === "development" && process.env.DEV_MOCK_STREAK === "true";

const MOCK_STREAK = 5;
const MOCK_LONGEST = 12;

/** True only for a session that has done nothing at all yet. */
function untouched(session: Session): boolean {
  return (
    !session.streak.lastActivityDate &&
    session.streak.current === 0 &&
    session.completedLessons.length === 0 &&
    Object.keys(session.activity).length === 0 &&
    session.notebook.length === 0
  );
}

export function withMockProgress(session: Session, today: string): Session {
  if (!MOCK_ENABLED || !untouched(session)) return session;

  const yesterday = addDays(today, -1);

  // One entry per day of the streak, ending yesterday. The counts vary so the
  // week strip and the daily goal are not obviously synthetic.
  const lessonsPerDay = [2, 1, 3, 1, 2];
  const activity = Object.fromEntries(
    lessonsPerDay.map((count, i) => [addDays(yesterday, i - (MOCK_STREAK - 1)), count]),
  );
  const lessonsDone = lessonsPerDay.reduce((a, b) => a + b, 0);

  // A learner mid-streak has finished the first lesson on their path; leaving
  // it unfinished would read as a 5-day streak with nothing to show for it.
  const completedLessons = session.languageId ? [`${session.languageId}:meet`] : [];

  // One saved word, so the notebook has something in it. Taken from the seed
  // pool for the learner's own language rather than invented.
  const saved = seedWords.find((w) => w.languageId === session.languageId);

  return {
    ...session,
    streak: {
      current: MOCK_STREAK,
      longest: MOCK_LONGEST,
      // One banked freeze: earned at 7 days, and the only way to see the
      // "1 freeze banked" line without waiting a week.
      freezes: 1,
      lastActivityDate: yesterday,
    },
    activity,
    completedLessons,
    xp: lessonsDone * 10,
    notebook: saved ? [{ id: saved.id, type: "word", source: "word_of_day", savedAt: yesterday }] : [],
  };
}
