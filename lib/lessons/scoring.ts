/*
 * How close was the transcript to the phrase the learner was asked to say?
 *
 * Levenshtein over normalised characters, which is forgiving of the recogniser's
 * own spelling choices while still catching a genuinely different word. Scores
 * are per-word as well as overall, so the UI can point at what went wrong
 * instead of just saying "wrong".
 *
 * Deliberately not called an accent score: it grades the transcript, which is a
 * proxy for intelligibility, not for how native the learner sounded.
 */

export type PronunciationScore = {
  /** 0-100, how closely the transcript matched. */
  score: number;
  verdict: "correct" | "close" | "wrong";
  heard: string;
  target: string;
  /** Per-word, so the UI can highlight the ones that slipped. */
  words: { expected: string; ok: boolean }[];
};

/** Pass at 80: tolerates a recogniser's spelling wobble, rejects a wrong word. */
const PASS = 80;
const CLOSE = 55;

/** Lowercase, strip punctuation and accents, collapse whitespace. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  // Single row, rolled forward — the full matrix is never needed.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

/** 0-100 similarity between two strings. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 100;
  return Math.round((1 - levenshtein(a, b) / longest) * 100);
}

export function scorePronunciation(heard: string, target: string): PronunciationScore {
  const spoken = normalise(heard);
  const wanted = normalise(target);
  const score = spoken ? similarity(spoken, wanted) : 0;

  // Match each expected word against its best candidate in the transcript, so
  // word order slips don't fail an otherwise correct attempt.
  const spokenWords = spoken.split(" ").filter(Boolean);
  const words = wanted.split(" ").filter(Boolean).map((expected) => ({
    expected,
    ok: spokenWords.some((w) => similarity(w, expected) >= PASS),
  }));

  return {
    score,
    verdict: score >= PASS ? "correct" : score >= CLOSE ? "close" : "wrong",
    heard: heard.trim(),
    target: target.trim(),
    words,
  };
}

/*
 * Word-by-word assessment for lesson pronunciation exercises.
 *
 * Each expected word is looked for, in order, among the words the recogniser
 * heard, and gets one of three states:
 *
 *   good     heard as that word, and (where the recogniser reports it) with
 *            confidence ≥ CONFIDENT
 *   unclear  heard as something close to it, or as it but with low confidence
 *   missed   nothing in the transcript matches it
 *
 * That is what the UI highlights. It is word-level on purpose: no API scores
 * individual sounds in a Kenyan language (Azure's phoneme-level assessment has
 * no Kenyan locale), so claiming to know which sound slipped would be invented.
 */

export type WordStatus = "good" | "unclear" | "missed";
export type Verdict = "excellent" | "almost" | "practice";

export type WordAssessment = {
  expected: string;
  status: WordStatus;
  /** The word the recogniser heard in its place, when different. */
  heard?: string;
  confidence?: number;
};

export type PronunciationAssessment = {
  score: number;
  verdict: Verdict;
  transcript: string;
  words: WordAssessment[];
};

const CONFIDENT = 0.7;
const MATCH = 80;
const NEAR = 50;
/** How far ahead of the last match to look, so one inserted word doesn't derail the rest. */
const LOOKAHEAD = 3;

export const VERDICT_EXCELLENT = 85;
export const VERDICT_ALMOST = 60;

export function assessPronunciation(
  target: string,
  recognized: { transcript: string; words?: { word: string; confidence?: number }[] },
): PronunciationAssessment {
  // Matched without diacritics (recognisers drop them inconsistently), but
  // reported as written: "maĩ", not "mai" — in Gikuyu the tilde is the lesson.
  const written = target
    .split(/\s+/)
    .map((word) => ({ shown: word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""), key: normalise(word) }))
    .filter((word) => word.key);
  const expected = written.map((word) => word.key);
  // Prefer the recogniser's own word list (it carries confidence); fall back to
  // splitting the transcript, which is all the browser recogniser gives.
  const heard = (recognized.words?.length
    ? recognized.words.map((w) => ({ word: normalise(w.word), confidence: w.confidence }))
    : normalise(recognized.transcript).split(" ").map((word) => ({ word, confidence: undefined as number | undefined }))
  ).filter((w) => w.word);

  let cursor = 0;
  const words: WordAssessment[] = expected.map((want, index) => {
    const shown = written[index].shown;
    let best = { index: -1, sim: 0 };
    for (let i = cursor; i < Math.min(heard.length, cursor + LOOKAHEAD); i++) {
      const sim = similarity(heard[i].word, want);
      if (sim > best.sim) best = { index: i, sim };
    }
    if (best.index === -1 || best.sim < NEAR) return { expected: shown, status: "missed" };

    cursor = best.index + 1;
    const match = heard[best.index];
    const confident = match.confidence === undefined || match.confidence >= CONFIDENT;
    return {
      expected: shown,
      status: best.sim >= MATCH && confident ? "good" : "unclear",
      heard: match.word !== want ? match.word : undefined,
      confidence: match.confidence,
    };
  });

  const points = words.reduce((sum, w) => sum + (w.status === "good" ? 1 : w.status === "unclear" ? 0.6 : 0), 0);
  // Words said after the last match were never asked for. They cost a little,
  // capped so a stray "um" doesn't sink an otherwise good attempt.
  const penalty = Math.min((heard.length - cursor) * 5, 15);
  const score = expected.length ? Math.max(0, Math.round((points / expected.length) * 100) - penalty) : 0;

  return {
    score,
    verdict: score >= VERDICT_EXCELLENT ? "excellent" : score >= VERDICT_ALMOST ? "almost" : "practice",
    transcript: recognized.transcript.trim(),
    words,
  };
}
