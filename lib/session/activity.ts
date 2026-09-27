import { localDate, recordActivity } from "./streak";
import { DAILY_LESSON_GOAL, STREAK_MILESTONES, XP_PER_LESSON, type Session } from "./types";

/*
 * One qualifying activity — a completed level or a notebook review — applied
 * to the session: today's count, the streak (once per calendar day) and XP.
 *
 * A plain module rather than part of ./actions, because a "use server" file
 * may only export server actions, and both the session and lesson actions
 * need this.
 */

export type LessonResult = {
  streak: number;
  streakIncremented: boolean;
  /** Set when this activity took the streak to 7, 30, 100 or 365 days. */
  milestone: number | null;
  lessonsToday: number;
  goal: number;
  xpEarned: number;
};

export function recordSessionActivity(session: Session): { session: Session; result: LessonResult } {
  const today = localDate();
  const { streak, incremented } = recordActivity(session.streak, today);
  const lessonsToday = (session.activity[today] ?? 0) + 1;
  const recent = Object.entries(session.activity).sort().slice(-13);
  return {
    session: {
      ...session,
      streak,
      xp: session.xp + XP_PER_LESSON,
      activity: { ...Object.fromEntries(recent), [today]: lessonsToday },
    },
    result: {
      streak: streak.current,
      streakIncremented: incremented,
      milestone: incremented && STREAK_MILESTONES.includes(streak.current) ? streak.current : null,
      lessonsToday,
      goal: DAILY_LESSON_GOAL,
      xpEarned: XP_PER_LESSON,
    },
  };
}
