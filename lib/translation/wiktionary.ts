import "server-only";
import { ENGLISH } from "./codes";

/*
 * English Wiktionary as a translation source.
 *
 * This is the widest source we have for Kenya's languages by a long way.
 * Google translates four of the registry's entries; Wiktionary's translation
 * tables reach twenty-plus, including Gikuyu, Kamba, Maasai, Meru and Luhya,
 * which no machine translator covers at all.
 *
 * It is human-edited and cited, not machine output, so it enters at
 * `corpus_supported` — above Google's `machine_generated`, below anything a
 * speaker has verified for us. Content is CC BY-SA 4.0 and the UI attributes
 * it (docs/spec.md: every record carries provenance).
 *
 * Limits, by design rather than omission:
 *  - English -> target only. Translation tables hang off English headwords.
 *  - Single words only. It is a dictionary; sentences go to Google.
 */

const API = "https://en.wiktionary.org/w/api.php";
const TIMEOUT_MS = 8000;
const CACHE_SECONDS = 60 * 60 * 24 * 30;

/** Wiktionary asks for a descriptive agent on API traffic. */
const USER_AGENT = "Mizizi/0.1 (Kenya language learning; https://github.com/maobenigel-git/mizizi)";

export const WIKTIONARY_LICENSE = "CC BY-SA 4.0";

/**
 * Mizizi language id -> Wiktionary language code.
 *
 * Wiktionary uses ISO 639-1 where one exists and 639-3 otherwise, so this does
 * not always match the registry's `iso639_3` (Kiswahili is `sw` here but `swh`
 * there; Gikuyu is `ki`, not `kik`). Each code below was confirmed to return
 * real entries, so the map is a verified list rather than a guess.
 */
const wiktionaryCodes: Record<string, string> = {
  kiswahili: "sw",
  gikuyu: "ki",
  dholuo: "luo",
  kamba: "kam",
  maasai: "mas",
  ekegusii: "guz",
  somali: "so",
  kalenjin: "kln",
  borana: "om",
  orma: "om",
  meru: "mer",
  luhya: "luy",
  teso: "teo",
  turkana: "tuv",
  samburu: "saq",
  taita: "dav",
  embu: "ebu",
  digo: "dig",
  lubukusu: "bxk",
  kipsigis: "sgc",
  nandi: "niq",
  kuria: "kuj",
};

export function wiktionarySupports(languageId: string): boolean {
  return languageId in wiktionaryCodes;
}

export const wiktionaryLanguageCount = Object.keys(wiktionaryCodes).length;

/** Only headwords have translation tables, so anything with a space is out. */
const isSingleWord = (text: string) => !/\s/.test(text.trim());

async function wikitext(page: string): Promise<string> {
  const url = `${API}?action=parse&page=${encodeURIComponent(page)}&prop=wikitext&format=json&formatversion=2`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: CACHE_SECONDS },
    });
    if (!response.ok) return "";
    const body = await response.json();
    return typeof body?.parse?.wikitext === "string" ? body.parse.wikitext : "";
  } catch {
    return "";
  }
}

/**
 * Pulls the translation out of a table row. Wiktionary writes these four ways
 * — `{{t|..}}`, `{{t+|..}}`, `{{tt|..}}`, `{{tt+|..}}` — and the `+`/`tt`
 * variants only mean "the target wiki has this page", not anything semantic.
 */
function findTranslation(text: string, code: string): string | undefined {
  const pattern = new RegExp(`\\{\\{tt?\\+?\\|${code}\\|([^|}]+)`, "g");
  for (const match of text.matchAll(pattern)) {
    const term = match[1].trim();
    // Skip the placeholders editors leave behind for missing entries.
    if (term && term !== "-" && !term.startsWith("{{")) return term;
  }
  return undefined;
}

/**
 * Translates one English word. Returns undefined when the pair is unsupported,
 * the word is not a headword, or the language has no row in its table.
 */
export async function wiktionaryTranslate(text: string, from: string, to: string): Promise<string | undefined> {
  const code = wiktionaryCodes[to];
  if (!code || from !== ENGLISH || !isSingleWord(text)) return undefined;

  const word = text.trim().toLowerCase();
  // Long tables live on a /translations subpage, short ones on the entry
  // itself, and there is no way to know which without asking. Fetching both at
  // once costs one extra cached request but halves the wait — and a miss used
  // to mean two round-trips back to back before Google was even tried.
  const [subpage, entry] = await Promise.all([wikitext(`${word}/translations`), wikitext(word)]);
  return findTranslation(subpage, code) ?? findTranslation(entry, code);
}
