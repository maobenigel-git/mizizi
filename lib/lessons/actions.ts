"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createAttempt,
  finishAttempt,
  getAttempt,
  getLevelProgress,
  listPronunciation,
  listResults,
  recordResult,
  upsertProgress,
  type AnswerKey,
} from "@/lib/db/progress";
import { getSession, saveSession } from "@/lib/session";
import { recordSessionActivity, type LessonResult } from "@/lib/session/activity";
import { recognizerFor } from "@/lib/speech/recognition";
import { getLevel, listLevels } from "./levels";
import { recordUnchecked, speakingTarget, scoreAndRecord, type AssessError } from "./pronunciation";
import { canOpenLevel, evaluateAttempt } from "./progress";
import type { PronunciationAssessment } from "./scoring";

/*
 * The server half of a lesson. The browser holds the exercises without their
 * answers; every answer comes here to be graded against a key snapshotted
 * when the attempt started, and only completeLevel — after checking the
 * level's requirements — can mark a level done.
 */

/** Ensures the learner has the id their progress hangs off, minting one if not. */
async function learner() {
  const session = await getSession();
  if (!session.languageId) throw new Error("Choose a language first.");
  if (session.userId) return session;
  const withId = { ...session, userId: randomUUID() };
  await saveSession(withId);
  return withId;
}

export async function startAttempt(levelNumber: number): Promise<{ attemptId: string } | { error: string }> {
  const session = await learner();
  const languageId = session.languageId!;
  if (!(await canOpenLevel(session, languageId, levelNumber))) return { error: "That level is still locked." };
  const level = await getLevel(languageId, levelNumber);
  if (!level) return { error: "That level doesn't exist." };

  const answerKey: AnswerKey = Object.fromEntries(
    level.exercises.map((e) => [
      e.id,
      e.kind === "info"
        ? { kind: "info" as const }
        : e.kind === "pronunciation"
          ? { kind: "pronunciation" as const, text: e.text, required: e.required }
          : { kind: e.kind, answer: e.answer, explain: e.explain, required: e.required },
    ]),
  );

  const attempt = await createAttempt({
    id: randomUUID(),
    userId: session.userId!,
    languageId,
    levelNumber,
    lessonId: level.id,
    answerKey,
  });
  await upsertProgress(session.userId!, languageId, { levelNumber, lessonId: level.id, status: "in_progress" });
  return { attemptId: attempt.id };
}

export type AnswerResult =
  | { ok: true; correct: boolean; answer: number; explain?: string }
  | { ok: false; message: string };

export async function answerExercise(attemptId: string, exerciseId: string, choice: number): Promise<AnswerResult> {
  const session = await getSession();
  if (!session.userId) return { ok: false, message: "Start the lesson again." };
  const attempt = await getAttempt(session.userId, attemptId);
  if (!attempt || attempt.finishedAt) return { ok: false, message: "That lesson has expired. Start it again." };
  const entry = attempt.answerKey[exerciseId];
  if (!entry || entry.kind === "info" || entry.kind === "pronunciation" || !Number.isInteger(choice)) {
    return { ok: false, message: "That answer couldn't be checked." };
  }

  const correct = choice === entry.answer;
  await recordResult(attemptId, exerciseId, correct);
  return { ok: true, correct, answer: entry.answer, explain: entry.explain };
}

/**
 * The browser-recogniser path: Chrome/Edge heard the learner and sent the
 * transcript. Only allowed where no server-side recogniser covers the
 * language — otherwise the audio goes to /api/pronunciation/assess.
 */
export async function assessTranscript(
  attemptId: string,
  exerciseId: string,
  transcript: string,
): Promise<{ ok: true; assessment: PronunciationAssessment } | ({ ok: false } & AssessError)> {
  const session = await getSession();
  if (!session.userId) return { ok: false, error: "not_found", message: "Start the lesson again." };
  const target = await speakingTarget(session.userId, attemptId, exerciseId);
  if ("error" in target) return { ok: false, ...target };
  if ((await recognizerFor(target.attempt.languageId)).kind !== "browser") {
    return { ok: false, error: "not_speaking", message: "Send the recording instead." };
  }
  const assessment = await scoreAndRecord(target.attempt, exerciseId, target.text, { transcript: transcript.slice(0, 300) }, "browser");
  return { ok: true, assessment };
}

/**
 * "Can't speak right now": the exercise is marked as passed on, unscored, so
 * no microphone, no quiet place or a speech impairment never blocks a level.
 */
export async function skipSpeaking(attemptId: string, exerciseId: string): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session.userId) return { ok: false };
  const target = await speakingTarget(session.userId, attemptId, exerciseId);
  if ("error" in target) return { ok: false };
  await recordUnchecked(target.attempt, exerciseId, target.text, true);
  return { ok: true };
}

export type CompletionResult =
  | {
      ok: true;
      level: number;
      score: number;
      activity: LessonResult;
      /** The level this completion opened, when there is one. */
      nextLevel: number | null;
      firstCompletion: boolean;
    }
  | { ok: false; score: number; passScore: number; missing: number; message: string };

export async function completeLevel(attemptId: string): Promise<CompletionResult> {
  const session = await getSession();
  const fail = (message: string): CompletionResult => ({ ok: false, score: 0, passScore: 0, missing: 0, message });
  if (!session.userId) return fail("Start the lesson again.");
  const attempt = await getAttempt(session.userId, attemptId);
  if (!attempt) return fail("That lesson has expired. Start it again.");
  if (attempt.finishedAt) return fail("That lesson is already finished.");

  const level = await getLevel(attempt.languageId, attempt.levelNumber);
  if (!level) return fail("That level no longer exists.");

  const [results, pronunciation] = await Promise.all([listResults(attemptId), listPronunciation(attemptId)]);
  const canScoreSpeech = (await recognizerFor(attempt.languageId)).kind !== "none";
  const evaluation = evaluateAttempt(attempt.answerKey, results, pronunciation, level.requirements, canScoreSpeech);

  if (!evaluation.passed) {
    await upsertProgress(session.userId, attempt.languageId, {
      levelNumber: attempt.levelNumber,
      lessonId: attempt.lessonId,
      status: "in_progress",
      progressPercentage: evaluation.progressPercentage,
      score: evaluation.score,
    });
    return {
      ok: false,
      score: evaluation.score,
      passScore: level.requirements.passScore,
      missing: evaluation.missing.length,
      message: evaluation.missing.length
        ? "A few exercises still need finishing."
        : `This level needs ${level.requirements.passScore}% to pass. You scored ${evaluation.score}%.`,
    };
  }

  const previous = await getLevelProgress(session.userId, attempt.languageId, attempt.levelNumber);
  await finishAttempt(attemptId, true);
  await upsertProgress(session.userId, attempt.languageId, {
    levelNumber: attempt.levelNumber,
    lessonId: attempt.lessonId,
    status: "completed",
    score: evaluation.score,
  });
  // Replaying a finished level still counts for the streak, but only a first
  // completion opens anything new on the path.
  const firstCompletion = previous?.status !== "completed";

  const { session: updated, result } = recordSessionActivity(session);
  await saveSession(updated);

  const total = (await listLevels(attempt.languageId)).length;
  revalidatePath("/learn");
  return {
    ok: true,
    level: attempt.levelNumber,
    score: evaluation.score,
    activity: result,
    nextLevel: attempt.levelNumber < total ? attempt.levelNumber + 1 : null,
    firstCompletion,
  };
}
