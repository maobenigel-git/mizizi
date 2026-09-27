import "server-only";
import { googleAccessToken, serviceAccount } from "./google-auth";
import type { Recognition, RecognitionError } from "./recognition";

/*
 * Google Cloud Speech-to-Text V2, synchronous recognize, model chirp_2.
 *
 * chirp_2 is the model Google lists with word-level confidence for all three
 * Kenyan languages it covers (checked against the supported-languages table):
 *
 *   Kiswahili sw-KE · Dholuo luo-KE · Kamba kam-KE
 *
 * in us-central1 and europe-west4. The recognizer's location and the API host
 * must match, so the host is regional:
 *   https://{region}-speech.googleapis.com/v2/projects/{project}/locations/{region}/recognizers/_:recognize
 *
 * Model adaptation (boosting the target phrase) is deliberately NOT used: it
 * would bias the recogniser towards hearing what the learner was supposed to
 * say, which is exactly what we are trying to check.
 *
 * Synchronous requests take up to 60 s / 10 MB of audio; lessons send ≤15 s.
 */

export const googleLocales: Record<string, string> = {
  kiswahili: "sw-KE",
  dholuo: "luo-KE",
  kamba: "kam-KE",
};

const MODEL = "chirp_2";
const REGIONS = ["us-central1", "europe-west4"];

function config() {
  const region = process.env.GOOGLE_SPEECH_REGION || "us-central1";
  const project = process.env.GOOGLE_CLOUD_PROJECT || serviceAccount()?.project_id;
  return { region, project };
}

/** True when a key and project are present and the region is one chirp_2 serves Kenya from. */
export function googleConfigured(): boolean {
  const { region, project } = config();
  return Boolean(serviceAccount() && project && REGIONS.includes(region));
}

type GoogleWord = { word?: string; confidence?: number };
type GoogleResponse = { results?: { alternatives?: { transcript?: string; words?: GoogleWord[] }[] }[] };

export async function googleRecognize(audio: Buffer, languageId: string): Promise<Recognition | RecognitionError> {
  const locale = googleLocales[languageId];
  const { region, project } = config();
  if (!locale || !googleConfigured()) return { error: "not_configured" };

  let token: string;
  try {
    token = await googleAccessToken();
  } catch {
    return { error: "not_configured" };
  }

  const url = `https://${region}-speech.googleapis.com/v2/projects/${project}/locations/${region}/recognizers/_:recognize`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          autoDecodingConfig: {},
          languageCodes: [locale],
          model: MODEL,
          features: { enableWordConfidence: true },
        },
        content: audio.toString("base64"),
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return { error: "unavailable" };
  }

  if (response.status === 401 || response.status === 403) return { error: "not_configured" };
  if (response.status === 429) return { error: "busy" };
  if (!response.ok) return { error: "unavailable" };

  const body = (await response.json()) as GoogleResponse;
  // Short clips come back as one result; join any extra ones in order.
  const alternatives = (body.results ?? []).map((r) => r.alternatives?.[0]).filter((a) => a !== undefined);
  return {
    transcript: alternatives.map((a) => a.transcript ?? "").join(" ").trim(),
    words: alternatives.flatMap((a) =>
      (a.words ?? []).filter((w) => w.word).map((w) => ({ word: w.word!, confidence: w.confidence })),
    ),
    provider: "google",
  };
}
