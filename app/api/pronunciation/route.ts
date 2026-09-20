import { scorePronunciation } from "@/lib/lessons/scoring";

/*
 * Scores a spoken attempt against the phrase the learner was asked to say.
 *
 * What this actually measures, stated plainly because the distinction matters:
 * the browser's speech recogniser turns the audio into text, and we compare
 * that text to the target. So it answers "were you understood as saying this?"
 * — not "how native did you sound?". Acoustic scoring against native-speaker
 * recordings is still v2 (docs/spec.md §2.4), and the UI says so.
 *
 * The audio never leaves the learner's device; only the transcript is sent.
 */

const MAX_LENGTH = 300;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { heard, target } = body ?? {};
  if (typeof heard !== "string" || typeof target !== "string" || !target.trim()) {
    return Response.json({ error: "bad_request", message: "Expected { heard, target }." }, { status: 400 });
  }
  return Response.json(scorePronunciation(heard.slice(0, MAX_LENGTH), target.slice(0, MAX_LENGTH)));
}
