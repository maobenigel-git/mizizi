import { ttsCodeFor } from "@/lib/speech/voices";

/*
 * Machine voice, proxied from Google Translate's keyless TTS endpoint.
 *
 * This is deliberately NOT the pronunciation endpoint. A synthesised voice is
 * not a native-speaker recording, and docs/spec.md §2.4 reserves pronunciation
 * for licensed recordings — so this route exists for reading back translations
 * and tutor replies, and every caller labels it as a machine voice.
 *
 * Proxied rather than called from the browser because the endpoint sends no
 * CORS headers, and because it keeps the learner's text off a third-party
 * referer.
 */

const MAX_LENGTH = 200;
const TIMEOUT_MS = 8000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const text = (params.get("text") ?? "").trim().slice(0, MAX_LENGTH);
  const language = params.get("lang") ?? "";

  if (!text) {
    return Response.json({ error: "bad_request", message: "Pass ?text=" }, { status: 400 });
  }
  const code = ttsCodeFor(language);
  if (!code) {
    // The client falls back to the browser's own synthesiser on this.
    return Response.json(
      { error: "no_voice", message: "No machine voice is available for this language." },
      { status: 404 },
    );
  }

  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${code}&q=${encodeURIComponent(text)}`;
  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "force-cache",
    });
    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("audio/")) {
      return Response.json({ error: "no_voice", message: "The voice service declined this phrase." }, { status: 404 });
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        // Same phrase, same audio: worth caching hard at the edge.
        "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable",
      },
    });
  } catch {
    return Response.json({ error: "unavailable", message: "The voice service is unreachable." }, { status: 502 });
  }
}
