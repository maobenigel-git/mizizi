import "server-only";
import {
  listProgress,
  upsertProgress,
  type AnswerKey,
  type ExerciseResult,
  type LevelProgress,
  type PronunciationSummary,
} from "@/lib/db/progress";
import type { Session } from "@/lib/session/types";
import { levelForSlug, listLevels, type LevelSummary, type Requirements } from "./levels";

/*
 * The rules of the path, in one place and only on the server:
 *
 *   - Level 1 is always open; level N opens when level N-1 is completed.
 *   - The current level is the first open level not yet completed (or the
 *     last level, once everything is done).
 *   - A level is completed only when its attempt satisfies the level's
 *     requirements (evaluateAttempt); the browser never says so itself.
 */

export type LevelState = "completed" | "current" | "open" | "locked";
export type PathLevel = LevelSummary & { state: LevelState; score: number | null };

export function isUnlocked(completed: Set<number>, level: number): boolean {
  return level === 1 || completed.has(level - 1);
}

function completedSet(progress: LevelProgress[]): Set<number> {
  return new Set(progress.filter((p) => p.status === "completed").map((p) => p.levelNumber));
}

/*
 * Before levels existed, finished lessons were a list of ids in the session
 * cookie ("gikuyu:words"). They are copied into the progress table the first
 * time the learner's path is read, once per level, so nobody loses a
 * completed lesson to the change. Idempotent: an upsert of "completed" on a
 * completed row changes nothing.
 */
async function importLegacy(userId: string, languageId: string, session: Session, progress: LevelProgress[]) {
  const done = completedSet(progress);
  const legacy = session.completedLessons
    .filter((id) => id.startsWith(`${languageId}:`))
    .map((id) => ({ id, level: levelForSlug(languageId, id.slice(languageId.length + 1)) }))
    .filter((l): l is { id: string; level: number } => l.level !== undefined && !done.has(l.level));
  if (legacy.length === 0) return progress;

  for (const { id, level } of legacy) {
    await upsertProgress(userId, languageId, { levelNumber: level, lessonId: id, status: "completed", progressPercentage: 100 });
  }
  return listProgress(userId, languageId);
}

export type LearnerPath = {
  levels: PathLevel[];
  total: number;
  /** The level to open next. */
  current: number;
  completedCount: number;
};

export async function learnerPath(session: Session, languageId: string): Promise<LearnerPath> {
  const [levels, stored] = await Promise.all([
    listLevels(languageId),
    session.userId ? listProgress(session.userId, languageId) : Promise.resolve([]),
  ]);
  const progress = session.userId ? await importLegacy(session.userId, languageId, session, stored) : stored;
  const completed = completedSet(progress);
  const scores = new Map(progress.map((p) => [p.levelNumber, p.score]));

  const firstOpen = levels.find((l) => !completed.has(l.number) && isUnlocked(completed, l.number));
  const current = firstOpen?.number ?? levels.length;

  return {
    total: levels.length,
    current,
    completedCount: levels.filter((l) => completed.has(l.number)).length,
    levels: levels.map((l) => ({
      ...l,
      score: scores.get(l.number) ?? null,
      state: completed.has(l.number)
        ? "completed"
        : l.number === current
          ? "current"
          : isUnlocked(completed, l.number)
            ? "open"
            : "locked",
    })),
  };
}

export async function canOpenLevel(session: Session, languageId: string, level: number): Promise<boolean> {
  if (level === 1) return true;
  if (!session.userId) return false;
  const path = await learnerPath(session, languageId);
  const state = path.levels[level - 1]?.state;
  return state !== undefined && state !== "locked";
}

/* ── completion ───────────────────────────────────────────────────────── */

/** Provider recorded for a spoken attempt the recogniser could not check. */
export const UNCHECKED = "unavailable";
/** Provider recorded when the learner chose "Can't speak right now". */
export const SKIPPED = "skipped";

export type Evaluation = {
  /** Required exercises satisfied / total required, 0–100. */
  progressPercentage: number;
  /** First-try accuracy on graded exercises, blended with best pronunciation scores. */
  score: number;
  passed: boolean;
  /** Required exercises still unsatisfied. */
  missing: string[];
};

export function evaluateAttempt(
  key: AnswerKey,
  results: ExerciseResult[],
  pronunciation: PronunciationSummary[],
  requirements: Requirements,
  /** False when no recogniser covers the language: speaking can't be required. */
  canScoreSpeech: boolean,
): Evaluation {
  const missing: string[] = [];
  const scores: number[] = [];
  let required = 0;

  for (const [id, entry] of Object.entries(key)) {
    if (entry.kind === "info") continue;

    if (entry.kind === "pronunciation") {
      // Every try counts towards the skip allowance, including ones the
      // recogniser failed to check (provider "unavailable") — an outage must
      // never trap a learner. Only checked tries count towards the score.
      const attempts = pronunciation.filter((p) => p.exerciseId === id);
      const checked = attempts.filter((p) => p.provider !== UNCHECKED && p.provider !== SKIPPED);
      const best = checked.reduce((max, p) => Math.max(max, p.score), 0);
      if (checked.length > 0) scores.push(best);
      if (!entry.required || !canScoreSpeech) continue;
      required++;
      // A learner who can't speak right now (no microphone, a quiet place, a
      // speech impairment) can always pass on it; it just doesn't score.
      const satisfied =
        best >= requirements.pronunciationPass ||
        attempts.length >= requirements.pronunciationAttemptsToSkip ||
        attempts.some((p) => p.provider === SKIPPED);
      if (!satisfied) missing.push(id);
      continue;
    }

    const answers = results.filter((r) => r.exerciseId === id);
    if (answers.length > 0) scores.push(answers[0].correct ? 100 : 0);
    if (!entry.required) continue;
    required++;
    // Missed questions come back until they are answered right, so "satisfied"
    // means right at least once; the score keeps the first try.
    if (!answers.some((a) => a.correct)) missing.push(id);
  }

  const score = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
  return {
    progressPercentage: required ? Math.round(((required - missing.length) / required) * 100) : 100,
    score,
    passed: missing.length === 0 && score >= requirements.passScore,
    missing,
  };
}
