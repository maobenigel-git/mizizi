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
