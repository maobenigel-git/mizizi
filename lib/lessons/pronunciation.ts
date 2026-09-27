import "server-only";
import { getAttempt, recordPronunciation, upsertProgress, type Attempt } from "@/lib/db/progress";
import { allowPronunciationAttempt } from "@/lib/rate-limit";
import { SKIPPED, UNCHECKED } from "./progress";
import { assessPronunciation, type PronunciationAssessment } from "./scoring";

/*
 * Shared by both ways a spoken attempt reaches the server — audio for a
 * server-side recogniser (/api/pronunciation/assess) and a transcript from the
 * browser's own recogniser (assessTranscript) — so they are scored, stored and
 * counted identically.
 */

export type AssessError = { error: "not_found" | "finished" | "not_speaking" | "limited"; message: string };

/** Loads the attempt and the target text for a speaking exercise, or says why not. */
export async function speakingTarget(
  userId: string,
  attemptId: string,
  exerciseId: string,
): Promise<{ attempt: Attempt; text: string } | AssessError> {
  const attempt = await getAttempt(userId, attemptId);
  if (!attempt) return { error: "not_found", message: "That lesson has expired. Start it again." };
  if (attempt.finishedAt) return { error: "finished", message: "That lesson is already finished." };
  const entry = attempt.answerKey[exerciseId];
  if (entry?.kind !== "pronunciation") return { error: "not_speaking", message: "That isn't a speaking exercise." };
  if (!allowPronunciationAttempt(userId)) {
    return { error: "limited", message: "That's a lot of practice for one hour. Take a break and come back." };
  }
  return { attempt, text: entry.text };
}

export async function scoreAndRecord(
  attempt: Attempt,
  exerciseId: string,
  text: string,
  recognition: { transcript: string; words?: { word: string; confidence?: number }[] },
  provider: string,
): Promise<PronunciationAssessment> {
  const assessment = assessPronunciation(text, recognition);
  await recordPronunciation({
    userId: attempt.userId,
    attemptId: attempt.id,
    exerciseId,
    languageId: attempt.languageId,
    targetText: text,
    transcript: assessment.transcript,
    score: assessment.score,
    verdict: assessment.verdict,
    words: assessment.words,
    provider,
  });
  await upsertProgress(attempt.userId, attempt.languageId, {
    levelNumber: attempt.levelNumber,
    lessonId: attempt.lessonId,
    status: "in_progress",
    pronunciationAttempts: 1,
  });
  return assessment;
}

/**
 * A try the recogniser failed to check — or, with `skipped`, one the learner
 * passed on ("Can't speak right now") (outage, timeout, busy). Recorded so it
 * counts towards the skip allowance, with provider "unavailable" so it never
 * counts towards the learner's score.
 */
export async function recordUnchecked(attempt: Attempt, exerciseId: string, text: string, skipped = false): Promise<void> {
  await recordPronunciation({
    userId: attempt.userId,
    attemptId: attempt.id,
    exerciseId,
    languageId: attempt.languageId,
    targetText: text,
    transcript: "",
    score: 0,
    verdict: "practice",
    words: [],
    provider: skipped ? SKIPPED : UNCHECKED,
  });
}
