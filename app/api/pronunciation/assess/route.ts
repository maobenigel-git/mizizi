import { getSession } from "@/lib/session";
import { recordUnchecked, speakingTarget, scoreAndRecord } from "@/lib/lessons/pronunciation";
import { recognize, recognizerFor } from "@/lib/speech/recognition";

/*
 * POST /api/pronunciation/assess — multipart form:
 *   audio       WAV (16 kHz mono PCM), recorded in the browser (components/lessons/useRecorder)
 *   attemptId   the lesson attempt, which must belong to this learner
 *   exerciseId  a pronunciation exercise in that attempt
 *
 * The target text comes from the attempt's answer key on the server, never
 * from the request, so a client can't ask to be graded against something easier.
 * The audio is sent to the language's recogniser (lib/speech/recognition) and
 * is not stored anywhere; only the scores are.
 *
 * A recogniser failure is still recorded as an (unscored) try, so an outage
 * can't trap a learner on a required speaking exercise.
 *
 * Responses: 200 { assessment } · 400 bad input · 401 no session · 404 attempt
 * not found · 409 attempt finished · 413 too long · 429 rate-limited or
 * recogniser busy · 503 no recogniser configured · 502 recogniser failed.
 */

const MAX_BYTES = 600_000; // ~18 s of 16 kHz 16-bit mono

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "unauthorized", message: "Start the lesson again." }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const attemptId = String(form?.get("attemptId") ?? "");
  const exerciseId = String(form?.get("exerciseId") ?? "");
  if (!(audio instanceof Blob) || !attemptId || !exerciseId) {
    return Response.json({ error: "bad_request", message: "Expected audio, attemptId and exerciseId." }, { status: 400 });
  }
  if (audio.size > MAX_BYTES) {
    return Response.json({ error: "too_long", message: "That recording is too long. Keep it under 15 seconds." }, { status: 413 });
  }
  if (audio.size < 4_000) {
    return Response.json({ error: "too_short", message: "That was too short to hear. Hold on a moment longer." }, { status: 400 });
  }

  const target = await speakingTarget(session.userId, attemptId, exerciseId);
  if ("error" in target) {
    const status = { not_found: 404, finished: 409, not_speaking: 400, limited: 429 }[target.error];
    return Response.json(target, { status });
  }
  if ((await recognizerFor(target.attempt.languageId)).kind !== "server") {
    return Response.json({ error: "no_recognizer", message: "Speech checking isn't available for this language." }, { status: 503 });
  }

  const recognition = await recognize(Buffer.from(await audio.arrayBuffer()), target.attempt.languageId);
  if ("error" in recognition) {
    // Counts towards the "skip after 3 tries" allowance, never towards the score.
    await recordUnchecked(target.attempt, exerciseId, target.text);
    const [status, message] = {
      not_configured: [503, "Speech checking isn't set up right now."],
      busy: [429, "The speech checker is busy. Try again in a moment."],
      unavailable: [502, "Couldn't check that one. Try again."],
    }[recognition.error] as [number, string];
    return Response.json({ error: recognition.error, message }, { status });
  }

  const assessment = await scoreAndRecord(target.attempt, exerciseId, target.text, recognition, recognition.provider);
  return Response.json({ assessment });
}
