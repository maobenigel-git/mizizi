import "server-only";
import type { Exercise, ExerciseKind, Requirements } from "@/lib/lessons/levels";
import { sql } from "./client";

/*
 * Authored levels: rows in courses → lessons → lesson_exercises
 * (supabase/migrations/0003). lib/lessons/levels merges these over the
 * generated orientation levels.
 *
 * Only published lessons in a published course are returned. Without
 * DATABASE_URL there are none, and the path is the generated levels alone.
 */

export type AuthoredLevel = {
  id: string;
  number: number;
  title: string;
  summary: string;
  kinds: ExerciseKind[];
  requirements: Partial<Requirements>;
  exercises: Exercise[];
};

const KINDS: ExerciseKind[] = ["info", "choice", "listening", "pronunciation", "final_check"];

export async function listAuthoredLevels(languageId: string): Promise<Omit<AuthoredLevel, "exercises" | "requirements">[]> {
  if (!sql) return [];
  const rows = await sql`
    select l.id, l.level_number, l.title, l.summary,
           coalesce(array_agg(distinct e.kind) filter (where e.kind is not null), '{}') as kinds
    from lessons l
    join courses c on c.id = l.course_id and c.published
    left join lesson_exercises e on e.lesson_id = l.id
    where c.language_id = ${languageId} and l.published and l.level_number is not null
    group by l.id
    order by l.level_number`;
  return rows.map((r) => ({
    id: r.id,
    number: r.level_number,
    title: r.title,
    summary: r.summary,
    kinds: (r.kinds as string[]).filter((k): k is ExerciseKind => KINDS.includes(k as ExerciseKind)),
  }));
}

export async function getAuthoredLevel(languageId: string, number: number): Promise<AuthoredLevel | undefined> {
  if (!sql) return undefined;
  const [lesson] = await sql`
    select l.id, l.level_number, l.title, l.summary, l.requirements
    from lessons l
    join courses c on c.id = l.course_id and c.published
    where c.language_id = ${languageId} and l.level_number = ${number} and l.published`;
  if (!lesson) return undefined;

  const rows = await sql`
    select id, kind, content, required from lesson_exercises
    where lesson_id = ${lesson.id} order by position`;
  // Content is JSON written by people: anything that doesn't match its kind's
  // shape is skipped rather than rendered broken.
  const exercises = rows.flatMap((r): Exercise[] => {
    const exercise = { ...r.content, id: r.id, kind: r.kind, required: r.required } as Exercise;
    if (exercise.kind === "pronunciation") {
      // Unverified unless the row says otherwise: never shown as checked by default.
      exercise.origin = "authored";
      exercise.verified = r.content?.verified === true;
    }
    return isValid(exercise) ? [exercise] : [];
  });

  return {
    id: lesson.id,
    number: lesson.level_number,
    title: lesson.title,
    summary: lesson.summary,
    kinds: [...new Set(exercises.map((e) => e.kind))],
    requirements: lesson.requirements ?? {},
    exercises,
  };
}

function isValid(e: Exercise): boolean {
  switch (e.kind) {
    case "info":
      return typeof e.title === "string" && typeof e.body === "string";
    case "choice":
    case "final_check":
    case "listening":
      return (
        Array.isArray(e.options) &&
        e.options.length >= 2 &&
        Number.isInteger(e.answer) &&
        e.answer >= 0 &&
        e.answer < e.options.length &&
        (e.kind === "listening" ? typeof e.text === "string" : typeof e.prompt === "string")
      );
    case "pronunciation":
      return typeof e.text === "string" && typeof e.meaning === "string";
    default:
      return false;
  }
}
