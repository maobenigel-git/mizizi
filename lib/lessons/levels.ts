import "server-only";
import { seedWords } from "@/data/seed/word-of-day";
import { listAuthoredLevels, getAuthoredLevel, type AuthoredLevel } from "@/lib/db/lessons";
import { hasMachineVoice } from "@/lib/speech/voices";
import { getSpeakingLesson } from "./speaking";
import { generatedCourse, type Lesson } from "./orientation";

/*
 * The level catalogue: Level 1, 2, 3 … for each language.
 *
 * Two sources, merged by level number:
 *
 *   generated  the orientation course (./orientation) built from the registry
 *              and seeded vocabulary — every language has these on day one
 *   authored   rows in lessons + lesson_exercises (lib/db/lessons)
 *
 * An authored level N replaces generated level N; authored levels past the end
 * extend the path. The path stops at the first gap, so a half-published run of
 * levels can't strand a learner on a level with nothing after it.
 *
 * Nothing here is per-language: adding Level 101 is a database insert.
 */

export type ExerciseKind = "info" | "choice" | "listening" | "pronunciation" | "final_check";

type Base = { id: string; required: boolean };
export type ChoiceExercise = Base & {
  kind: "choice" | "final_check";
  prompt: string;
  options: string[];
  answer: number;
  explain?: string;
  wordId?: string;
};
export type ListeningExercise = Base & {
  kind: "listening";
  /** What is played. Revealed on screen only after answering. */
  text: string;
  options: string[];
  answer: number;
  explain?: string;
  audioUrl?: string;
  wordId?: string;
};
export type PronunciationExercise = Base & {
  kind: "pronunciation";
  text: string;
  meaning: string;
  /** A native-speaker recording. Always preferred over any machine voice. */
  audioUrl?: string;
  wordId?: string;
  origin: "graph" | "wiktionary" | "google" | "authored";
  verified: boolean;
};
export type InfoExercise = Base & { kind: "info"; title: string; body: string };
export type Exercise = InfoExercise | ChoiceExercise | ListeningExercise | PronunciationExercise;

export type Requirements = {
  /** First-try score (0–100) needed to pass. 0 = finishing is enough. */
  passScore: number;
  /** A pronunciation exercise is satisfied by a score at or above this… */
  pronunciationPass: number;
  /** …or by this many scored attempts, so a recogniser can never block a learner. */
  pronunciationAttemptsToSkip: number;
};

export const DEFAULT_REQUIREMENTS: Requirements = { passScore: 0, pronunciationPass: 60, pronunciationAttemptsToSkip: 3 };

export type LevelSummary = {
  /** Stable content id: "gikuyu:meet" for generated levels, the lessons.id for authored ones. */
  id: string;
  number: number;
  title: string;
  summary: string;
  kinds: ExerciseKind[];
};

export type Level = LevelSummary & {
  languageId: string;
  slug?: string;
  exercises: Exercise[];
  requirements: Requirements;
};

/* ── generated levels ─────────────────────────────────────────────────── */

const LISTENING_PER_LEVEL = 2;
const SPEAKING_PER_LEVEL = 2;
const FINAL_CHECK_PER_LEVEL = 2;

function rotate<T>(items: T[], by: number): T[] {
  const shift = by % Math.max(items.length, 1);
  return [...items.slice(shift), ...items.slice(0, shift)];
}

/*
 * A generated lesson's steps become exercises. Vocabulary levels also get the
 * rest of the learning loop — listening, speaking and a final check — built
 * from the same cited words, never from anything new:
 *
 *   listening      only where there is a voice to play (a machine voice for
 *                  Kiswahili; labelled as such in the UI)
 *   pronunciation  always offered; scored only where a recogniser exists
 *   final check    the same words the other way round: meaning → word
 */
function fromLesson(languageId: string, lesson: Lesson): Exercise[] {
  const exercises: Exercise[] = lesson.steps.map((step, i) =>
    step.kind === "info"
      ? { id: `${lesson.id}#${i}`, kind: "info", required: false, title: step.title, body: step.body }
      : { ...step, id: `${lesson.id}#${i}`, kind: "choice", required: true },
  );

  // The words this level tests, straight from the seed pool — the same cited
  // entries, carrying any native recording they have.
  const words = lesson.steps.flatMap((step) => {
    const word = step.kind === "choice" && step.wordId ? seedWords.find((w) => w.id === step.wordId) : undefined;
    return step.kind === "choice" && word ? [{ step, word }] : [];
  });
  if (words.length === 0) return exercises;
  const terms = [...new Set(words.map(({ word }) => word.term))];

  if (hasMachineVoice(languageId) || words.some(({ word }) => word.audioUrl)) {
    words.slice(0, LISTENING_PER_LEVEL).forEach(({ step, word }, i) => {
      if (!word.audioUrl && !hasMachineVoice(languageId)) return;
      const options = rotate(step.options, i + 1);
      exercises.push({
        id: `${lesson.id}#listen-${i}`,
        kind: "listening",
        required: true,
        text: word.term,
        options,
        answer: options.indexOf(word.meaning),
        explain: step.explain,
        audioUrl: word.audioUrl,
        wordId: word.id,
      });
    });
  }

  words.slice(0, SPEAKING_PER_LEVEL).forEach(({ word }, i) => {
    exercises.push({
      id: `${lesson.id}#say-${i}`,
      kind: "pronunciation",
      required: true,
      text: word.term,
      meaning: word.meaning,
      audioUrl: word.audioUrl,
      wordId: word.id,
      origin: "graph",
      verified: word.verified,
    });
  });

  words.slice(-FINAL_CHECK_PER_LEVEL).forEach(({ step, word }, i) => {
    const others = terms.filter((t) => t !== word.term);
    const options = [word.term, ...rotate(others, i).slice(0, 2)].sort();
    exercises.push({
      id: `${lesson.id}#check-${i}`,
      kind: "final_check",
      required: true,
      prompt: `Which word means “${word.meaning}”?`,
      options,
      answer: options.indexOf(word.term),
      explain: step.explain,
      wordId: word.id,
    });
  });

  return exercises;
}

function kindsOf(exercises: Exercise[]): ExerciseKind[] {
  return [...new Set(exercises.map((e) => e.kind))];
}

/** Summaries only: cheap, no network, safe to call for a path of any length. */
function generatedSummaries(languageId: string): LevelSummary[] {
  return generatedCourse(languageId).map((lesson, i) => ({
    id: lesson.id,
    number: i + 1,
    title: lesson.title,
    summary: lesson.summary,
    kinds: lesson.slug === "speaking" ? ["pronunciation"] : kindsOf(fromLesson(languageId, lesson)),
  }));
}

/*
 * The speaking level's phrases are topped up from Google / Wiktionary over the
 * network, so they are cached per instance: a lesson rebuilds its level on
 * every page load and every attempt, and the phrases rarely change.
 */
const SPEAKING_TTL_MS = 60 * 60 * 1000;
const speakingCache = new Map<string, { at: number; lesson: Awaited<ReturnType<typeof getSpeakingLesson>> }>();

async function speakingPhrases(languageId: string) {
  const hit = speakingCache.get(languageId);
  if (hit && Date.now() - hit.at < SPEAKING_TTL_MS) return hit.lesson;
  const lesson = await getSpeakingLesson(languageId);
  // Don't cache an empty result: it is more likely a network blip than a fact.
  if (lesson.phrases.length > 0) speakingCache.set(languageId, { at: Date.now(), lesson });
  return lesson;
}

async function generatedLevel(languageId: string, number: number): Promise<Level | undefined> {
  const lesson = generatedCourse(languageId)[number - 1];
  if (!lesson) return undefined;

  let exercises: Exercise[];
  if (lesson.slug === "speaking") {
    // Phrases come from the word graph, topped up from Google / Wiktionary —
    // each labelled with where it came from.
    const speaking = await speakingPhrases(languageId);
    exercises = speaking.phrases.map((p) => ({
      id: `${lesson.id}#${p.id}`,
      kind: "pronunciation" as const,
      required: true,
      text: p.text,
      meaning: p.meaning,
      origin: p.origin,
      verified: p.verified,
    }));
  } else {
    exercises = fromLesson(languageId, lesson);
  }

  return {
    id: lesson.id,
    number,
    slug: lesson.slug,
    title: lesson.title,
    summary: lesson.summary,
    kinds: kindsOf(exercises),
    languageId,
    exercises,
    requirements: DEFAULT_REQUIREMENTS,
  };
}

/* ── the merged catalogue ─────────────────────────────────────────────── */

function authoredSummary(level: Omit<AuthoredLevel, "exercises" | "requirements">): LevelSummary {
  return { id: level.id, number: level.number, title: level.title, summary: level.summary, kinds: level.kinds };
}

/** Every level of a language, in order, stopping at the first gap. */
export async function listLevels(languageId: string): Promise<LevelSummary[]> {
  const byNumber = new Map(generatedSummaries(languageId).map((l) => [l.number, l]));
  for (const level of await listAuthoredLevels(languageId)) byNumber.set(level.number, authoredSummary(level));

  const levels: LevelSummary[] = [];
  for (let n = 1; byNumber.has(n); n++) levels.push(byNumber.get(n)!);
  return levels;
}

export async function getLevel(languageId: string, number: number): Promise<Level | undefined> {
  if (!Number.isInteger(number) || number < 1) return undefined;
  const authored = await getAuthoredLevel(languageId, number);
  if (authored) {
    return {
      ...authoredSummary(authored),
      languageId,
      exercises: authored.exercises,
      requirements: { ...DEFAULT_REQUIREMENTS, ...authored.requirements },
    };
  }
  // A generated level only counts if no gap precedes it (see listLevels).
  const levels = await listLevels(languageId);
  return number <= levels.length ? generatedLevel(languageId, number) : undefined;
}

/** Which level an old slug-based URL (/learn/words) now lives at. */
export function levelForSlug(languageId: string, slug: string): number | undefined {
  const index = generatedCourse(languageId).findIndex((l) => l.slug === slug);
  return index === -1 ? undefined : index + 1;
}

/* ── what the browser is allowed to see ───────────────────────────────── */

/** An exercise without its answer: grading happens on the server. */
export type ClientExercise =
  | InfoExercise
  | Omit<ChoiceExercise, "answer" | "explain">
  | Omit<ListeningExercise, "answer" | "explain">
  | PronunciationExercise;

export function toClient(exercise: Exercise): ClientExercise {
  if (exercise.kind === "choice" || exercise.kind === "final_check" || exercise.kind === "listening") {
    const copy: Partial<typeof exercise> = { ...exercise };
    delete copy.answer;
    delete copy.explain;
    return copy as ClientExercise;
  }
  return exercise;
}
