import "server-only";
import { ENGLISH } from "./codes";

/*
 * Google Translate, via the keyless endpoint the Chrome dictionary extension
 * uses. It costs nothing and needs no account, which is the whole reason it is
 * here — but it is a machine translator, so everything it returns is tagged
 * `machine_generated` and never replaces a graph entry (docs/spec.md §1.8).
 *
 * Only languages Google actually translates are listed in `googleCodes`. The
 * endpoint accepts some codes it does not translate (`kik` for Gikuyu, for one)
 * and echoes the input straight back; `isEcho` catches that so a passthrough is
 * never shown to a learner as a translation.
 */

const ENDPOINT = "https://clients5.google.com/translate_a/t";
const TIMEOUT_MS = 6000;
const CACHE_SECONDS = 60 * 60 * 24 * 7;

/** The endpoint refuses a request without a browser UA. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

/**
 * Mizizi language id → Google language code, for the registry entries Google
 * covers. Verified by probing the endpoint; the rest of the registry has no
 * machine translator, and the UI says so rather than guessing.
 *
 * Borana and Orma map to Google's Oromo (`om`): they are Oromo varieties, not
 * the same lect, so output is an approximation — which is what the
 * `machine_generated` tier and the engine label in the UI communicate.
 */
export const googleCodes: Record<string, string> = {
  [ENGLISH]: "en",
  kiswahili: "sw",
  dholuo: "luo",
  somali: "so",
  borana: "om",
  orma: "om",
};

export function googleSupports(languageId: string): boolean {
  return languageId in googleCodes;
}

const normalise = (text: string) => text.trim().toLowerCase().replace(/[\s.!?,]+/g, " ");

/** Google accepted the code but handed the text back untranslated. */
const isEcho = (input: string, output: string) => normalise(input) === normalise(output);

/**
 * Translates via Google, or returns undefined when the pair is unsupported,
 * the call fails, or the result is an echo. Never throws: a translator being
 * down is not a reason for the page to be.
 */
export async function googleTranslate(text: string, from: string, to: string): Promise<string | undefined> {
  const sl = googleCodes[from];
  const tl = googleCodes[to];
  if (!sl || !tl || sl === tl || !text.trim()) return undefined;

  const url = `${ENDPOINT}?client=dict-chrome-ex&sl=${sl}&tl=${tl}&q=${encodeURIComponent(text)}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // Machine output for a given phrase does not change day to day.
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return undefined;

    // Two shapes: ["translated"] for a known source, [["translated","sl"]] for auto.
    const body: unknown = await response.json();
    const first = Array.isArray(body) ? body[0] : undefined;
    const translated = typeof first === "string" ? first : Array.isArray(first) && typeof first[0] === "string" ? first[0] : undefined;

    if (!translated || isEcho(text, translated)) return undefined;
    return translated;
  } catch {
    return undefined;
  }
}
