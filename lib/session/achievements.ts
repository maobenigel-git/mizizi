import type { Session } from "./types";

// Achievements are derived from the session, never stored, so they can't drift
// out of step with the stats they describe.

export type Achievement = {
  id: string;
  title: string;
  detail: string;
  /** 0–1 progress towards unlocking. */
  progress: number;
  unlocked: boolean;
};

export function getAchievements(session: Session, courseLength: number, contributions: number): Achievement[] {
  const lessons = session.completedLessons.length;
  const courseDone = session.languageId
    ? session.completedLessons.filter((id) => id.startsWith(`${session.languageId}:`)).length
    : 0;

  const goals: [id: string, title: string, detail: string, have: number, need: number][] = [
    ["first-lesson", "First steps", "Finish your first lesson", lessons, 1],
    ["course", "Oriented", "Complete a language's orientation course", courseDone, Math.max(courseLength, 1)],
    ["streak-3", "Warming up", "Reach a 3-day streak", session.streak.longest, 3],
    ["streak-7", "One week strong", "Reach a 7-day streak", session.streak.longest, 7],
    ["streak-30", "Monthly habit", "Reach a 30-day streak", session.streak.longest, 30],
    ["xp-100", "Centurion", "Earn 100 XP", session.xp, 100],
    ["notebook-5", "Word collector", "Save 5 words to your notebook", session.notebook.length, 5],
    ["contributor", "Contributor", "Make your first contribution", contributions, 1],
  ];

  return goals.map(([id, title, detail, have, need]) => ({
    id,
    title,
    detail,
    progress: Math.min(have / need, 1),
    unlocked: have >= need,
  }));
}
