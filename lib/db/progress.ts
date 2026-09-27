import "server-only";
import type { WordAssessment, Verdict } from "@/lib/lessons/scoring";
import { memoryStore, sql } from "./client";

/*
 * Learner progress through levels, attempts, graded answers and scored
 * recordings (supabase/migrations/0003). Postgres when DATABASE_URL is set,
 * memory otherwise — like lib/db/notes.
 *
 * Keyed by the session's userId, which is the account id for anyone with an
 * account: signing in on another device reads the same rows.
 */

export type CompletionStatus = "in_progress" | "completed";

export type LevelProgress = {
  levelNumber: number;
  lessonId: string;
  status: CompletionStatus;
  progressPercentage: number;
  score: number | null;
  pronunciationAttempts: number;
  completedAt: string | null;
  lastAttemptAt: string;
};

/** What an attempt grades against, snapshotted when it starts. */
export type AnswerKey = Record<
  string,
  | { kind: "info" }
  | { kind: "choice" | "final_check" | "listening"; answer: number; explain?: string; required: boolean }
  | { kind: "pronunciation"; text: string; required: boolean }
>;

export type Attempt = {
  id: string;
  userId: string;
  languageId: string;
  levelNumber: number;
  lessonId: string;
  answerKey: AnswerKey;
  startedAt: string;
  finishedAt: string | null;
  passed: boolean | null;
};

export type ExerciseResult = { exerciseId: string; correct: boolean; answeredAt: string };

export type PronunciationRecord = {
  userId: string;
  attemptId: string;
  exerciseId: string;
  languageId: string;
  targetText: string;
  transcript: string;
  score: number;
  verdict: Verdict;
  words: WordAssessment[];
  provider: string;
};

/* ── memory fallback ─────────────────────────────────────────────────── */

const memory = memoryStore("progress", () => ({
  progress: new Map<string, LevelProgress>(), // `${userId}|${languageId}|${level}`
  attempts: new Map<string, Attempt>(),
  results: new Map<string, ExerciseResult[]>(), // by attemptId
  pronunciation: new Map<string, PronunciationRecord[]>(), // by attemptId
}));
const key = (userId: string, languageId: string, level: number) => `${userId}|${languageId}|${level}`;

/* ── progress ─────────────────────────────────────────────────────────── */

function rowToProgress(r: Record<string, unknown>): LevelProgress {
  return {
    levelNumber: r.level_number as number,
    lessonId: r.lesson_id as string,
    status: r.completion_status as CompletionStatus,
    progressPercentage: r.progress_percentage as number,
    score: (r.score as number | null) ?? null,
    pronunciationAttempts: r.pronunciation_attempts as number,
    completedAt: r.completed_at ? new Date(r.completed_at as string).toISOString() : null,
    lastAttemptAt: new Date(r.last_attempt_at as string).toISOString(),
  };
}

/** Every level this learner has touched in one language. Small: one row per level. */
export async function listProgress(userId: string, languageId: string): Promise<LevelProgress[]> {
  if (!sql) {
    return [...memory.progress.entries()]
      .filter(([k]) => k.startsWith(`${userId}|${languageId}|`))
      .map(([, p]) => p)
      .sort((a, b) => a.levelNumber - b.levelNumber);
  }
  const rows = await sql`
    select level_number, lesson_id, completion_status, progress_percentage, score,
           pronunciation_attempts, completed_at, last_attempt_at
    from user_lesson_progress where user_id = ${userId} and language_id = ${languageId}
    order by level_number`;
  return rows.map(rowToProgress);
}

export async function getLevelProgress(userId: string, languageId: string, level: number): Promise<LevelProgress | undefined> {
  if (!sql) return memory.progress.get(key(userId, languageId, level));
  const [row] = await sql`
    select level_number, lesson_id, completion_status, progress_percentage, score,
           pronunciation_attempts, completed_at, last_attempt_at
    from user_lesson_progress
    where user_id = ${userId} and language_id = ${languageId} and level_number = ${level}`;
  return row ? rowToProgress(row) : undefined;
}

/** Completed-level counts per language, for the profile. */
export async function countCompleted(userId: string): Promise<Record<string, number>> {
  if (!sql) {
    const counts: Record<string, number> = {};
    for (const [k, p] of memory.progress) {
      const [user, language] = k.split("|");
      if (user === userId && p.status === "completed") counts[language] = (counts[language] ?? 0) + 1;
    }
    return counts;
  }
  const rows = await sql`
    select language_id, count(*)::int as n from user_lesson_progress
    where user_id = ${userId} and completion_status = 'completed' group by language_id`;
  return Object.fromEntries(rows.map((r) => [r.language_id, r.n]));
}

/**
 * Records activity on a level. A completed level stays completed — replaying it
 * updates the best score and the attempt time, never the completion.
 */
export async function upsertProgress(
  userId: string,
  languageId: string,
  update: {
    levelNumber: number;
    lessonId: string;
    status: CompletionStatus;
    /** Omitted = leave the stored percentage as it is. */
    progressPercentage?: number;
    score?: number | null;
    pronunciationAttempts?: number;
  },
): Promise<LevelProgress> {
  const now = new Date().toISOString();
  if (!sql) {
    const k = key(userId, languageId, update.levelNumber);
    const prev = memory.progress.get(k);
    const completed = prev?.status === "completed" || update.status === "completed";
    const next: LevelProgress = {
      levelNumber: update.levelNumber,
      lessonId: update.lessonId,
      status: completed ? "completed" : "in_progress",
      progressPercentage: completed ? 100 : (update.progressPercentage ?? prev?.progressPercentage ?? 0),
      score: maxScore(prev?.score ?? null, update.score ?? null),
      pronunciationAttempts: (prev?.pronunciationAttempts ?? 0) + (update.pronunciationAttempts ?? 0),
      completedAt: prev?.completedAt ?? (update.status === "completed" ? now : null),
      lastAttemptAt: now,
    };
    memory.progress.set(k, next);
    return next;
  }
  const [row] = await sql`
    insert into user_lesson_progress
      (user_id, language_id, level_number, lesson_id, completion_status, progress_percentage,
       score, pronunciation_attempts, completed_at, last_attempt_at)
    values (${userId}, ${languageId}, ${update.levelNumber}, ${update.lessonId}, ${update.status},
            ${update.status === "completed" ? 100 : (update.progressPercentage ?? 0)}, ${update.score ?? null},
            ${update.pronunciationAttempts ?? 0}, ${update.status === "completed" ? now : null}, ${now})
    on conflict (user_id, language_id, level_number) do update set
      lesson_id = excluded.lesson_id,
      completion_status = case when user_lesson_progress.completion_status = 'completed'
                               then 'completed' else excluded.completion_status end,
      progress_percentage = case when user_lesson_progress.completion_status = 'completed' then 100
                                 when ${update.progressPercentage === undefined} then user_lesson_progress.progress_percentage
                                 else excluded.progress_percentage end,
      score = greatest(user_lesson_progress.score, excluded.score),
      pronunciation_attempts = user_lesson_progress.pronunciation_attempts + excluded.pronunciation_attempts,
      completed_at = coalesce(user_lesson_progress.completed_at, excluded.completed_at),
      last_attempt_at = excluded.last_attempt_at
    returning level_number, lesson_id, completion_status, progress_percentage, score,
              pronunciation_attempts, completed_at, last_attempt_at`;
  return rowToProgress(row);
}

function maxScore(a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return Math.max(a, b);
}

/* ── attempts ─────────────────────────────────────────────────────────── */

export async function createAttempt(attempt: Omit<Attempt, "startedAt" | "finishedAt" | "passed">): Promise<Attempt> {
  const full: Attempt = { ...attempt, startedAt: new Date().toISOString(), finishedAt: null, passed: null };
  if (!sql) {
    memory.attempts.set(full.id, full);
    return full;
  }
  await sql`
    insert into lesson_attempts (id, user_id, language_id, level_number, lesson_id, answer_key)
    values (${full.id}, ${full.userId}, ${full.languageId}, ${full.levelNumber}, ${full.lessonId},
            ${sql.json(full.answerKey as never)})`;
  return full;
}

/** Only the owner's attempt is ever returned. */
export async function getAttempt(userId: string, attemptId: string): Promise<Attempt | undefined> {
  if (!sql) {
    const attempt = memory.attempts.get(attemptId);
    return attempt?.userId === userId ? attempt : undefined;
  }
  const [r] = await sql`
    select id, user_id, language_id, level_number, lesson_id, answer_key, started_at, finished_at, passed
    from lesson_attempts where id = ${attemptId} and user_id = ${userId}`;
  if (!r) return undefined;
  return {
    id: r.id,
    userId: r.user_id,
    languageId: r.language_id,
    levelNumber: r.level_number,
    lessonId: r.lesson_id,
    answerKey: r.answer_key,
    startedAt: new Date(r.started_at).toISOString(),
    finishedAt: r.finished_at ? new Date(r.finished_at).toISOString() : null,
    passed: r.passed,
  };
}

export async function finishAttempt(attemptId: string, passed: boolean): Promise<void> {
  if (!sql) {
    const attempt = memory.attempts.get(attemptId);
    if (attempt) memory.attempts.set(attemptId, { ...attempt, finishedAt: new Date().toISOString(), passed });
    return;
  }
  await sql`update lesson_attempts set finished_at = now(), passed = ${passed} where id = ${attemptId}`;
}

export async function recordResult(attemptId: string, exerciseId: string, correct: boolean): Promise<void> {
  const result = { exerciseId, correct, answeredAt: new Date().toISOString() };
  if (!sql) {
    memory.results.set(attemptId, [...(memory.results.get(attemptId) ?? []), result]);
    return;
  }
  await sql`insert into exercise_results (attempt_id, exercise_id, correct) values (${attemptId}, ${exerciseId}, ${correct})`;
}

export async function listResults(attemptId: string): Promise<ExerciseResult[]> {
  if (!sql) return memory.results.get(attemptId) ?? [];
  const rows = await sql`
    select exercise_id, correct, answered_at from exercise_results
    where attempt_id = ${attemptId} order by answered_at, id`;
  return rows.map((r) => ({ exerciseId: r.exercise_id, correct: r.correct, answeredAt: new Date(r.answered_at).toISOString() }));
}

/* ── pronunciation ────────────────────────────────────────────────────── */

export async function recordPronunciation(record: PronunciationRecord): Promise<void> {
  if (!sql) {
    memory.pronunciation.set(record.attemptId, [...(memory.pronunciation.get(record.attemptId) ?? []), record]);
    return;
  }
  await sql`
    insert into pronunciation_attempts
      (user_id, attempt_id, exercise_id, language_id, target_text, transcript, score, verdict, words, provider)
    values (${record.userId}, ${record.attemptId}, ${record.exerciseId}, ${record.languageId}, ${record.targetText},
            ${record.transcript}, ${record.score}, ${record.verdict}, ${sql.json(record.words as never)}, ${record.provider})`;
}

export type PronunciationSummary = { exerciseId: string; score: number; provider: string };

export async function listPronunciation(attemptId: string): Promise<PronunciationSummary[]> {
  if (!sql) {
    return (memory.pronunciation.get(attemptId) ?? []).map((r) => ({ exerciseId: r.exerciseId, score: r.score, provider: r.provider }));
  }
  const rows = await sql`
    select exercise_id, score, provider from pronunciation_attempts where attempt_id = ${attemptId} order by created_at`;
  return rows.map((r) => ({ exerciseId: r.exercise_id, score: r.score, provider: r.provider }));
}
