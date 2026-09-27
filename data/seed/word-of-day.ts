// Placeholder Word of the Day pool until the `vocabulary` table is populated
// from Kencorpus / Common Voice. Entries are common Kiswahili words, kept
// `verified: false` and shown with a "seed data" label in the UI.

export type SeedWord = {
  id: string;
  languageId: string;
  term: string;
  meaning: string;
  /** Omitted where no cited example sentence exists — never invented. */
  example?: string;
  exampleMeaning?: string;
  note?: string;
  /** Where the entry came from, shown with it. Seed words without one are ours. */
  source?: { title: string; url: string; license: string };
  /** Hub of the translation graph (docs/spec.md §1.8). */
  conceptId: string;
  phonetic?: string;
  /** Native-speaker recording, once licensed audio is imported. */
  audioUrl?: string;
  verified: boolean;
};

export const seedWords: SeedWord[] = [
  {
    id: "kiswahili:karibu",
    languageId: "kiswahili",
    term: "karibu",
    conceptId: "WELCOME",
    meaning: "welcome",
    example: "Karibu Kenya.",
    exampleMeaning: "Welcome to Kenya.",
    note: "Also the usual reply to “asante”.",
    verified: false,
  },
  {
    id: "kiswahili:asante",
    languageId: "kiswahili",
    term: "asante",
    conceptId: "THANK_YOU",
    meaning: "thank you",
    example: "Asante sana.",
    exampleMeaning: "Thank you very much.",
    verified: false,
  },
  {
    id: "kiswahili:rafiki",
    languageId: "kiswahili",
    term: "rafiki",
    conceptId: "FRIEND",
    meaning: "friend",
    example: "Yeye ni rafiki yangu.",
    exampleMeaning: "He/She is my friend.",
    verified: false,
  },
  {
    id: "kiswahili:maji",
    languageId: "kiswahili",
    term: "maji",
    conceptId: "WATER",
    meaning: "water",
    example: "Ninakunywa maji.",
    exampleMeaning: "I am drinking water.",
    verified: false,
  },
  {
    id: "kiswahili:chakula",
    languageId: "kiswahili",
    term: "chakula",
    conceptId: "FOOD",
    meaning: "food",
    example: "Chakula ni kitamu.",
    exampleMeaning: "The food is delicious.",
    verified: false,
  },
  {
    id: "kiswahili:shule",
    languageId: "kiswahili",
    term: "shule",
    conceptId: "SCHOOL",
    meaning: "school",
    example: "Watoto wanaenda shule.",
    exampleMeaning: "The children are going to school.",
    note: "Borrowed from the German “Schule”.",
    verified: false,
  },
  {
    id: "kiswahili:safari",
    languageId: "kiswahili",
    term: "safari",
    conceptId: "JOURNEY",
    meaning: "journey",
    example: "Safari njema!",
    exampleMeaning: "Have a good journey!",
    note: "English borrowed “safari” from Kiswahili.",
    verified: false,
  },
  // ── Gikuyu ──────────────────────────────────────────────
  // Taken from English Wiktionary's Kikuyu entries, not written by us. No
  // example sentences: we have cited words but no cited Gikuyu sentences, and
  // an invented one would be exactly the guess the spec forbids. `verified`
  // stays false until a Gikuyu speaker checks these on Mizizi.
  {
    id: "gikuyu:mai",
    languageId: "gikuyu",
    term: "maĩ",
    conceptId: "WATER",
    meaning: "water",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/maĩ", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:mwaki",
    languageId: "gikuyu",
    term: "mwaki",
    conceptId: "FIRE",
    meaning: "fire",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/mwaki", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:irio",
    languageId: "gikuyu",
    term: "irio",
    conceptId: "FOOD",
    meaning: "food",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/irio", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:nyumba",
    languageId: "gikuyu",
    term: "nyũmba",
    conceptId: "HOUSE",
    meaning: "house",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/nyũmba", license: "CC BY-SA 4.0" },
    verified: false,
  },
  /*
   * Family and friends. Unlike the four above — which were read off
   * translation tables — each of these was taken from its own Kikuyu entry on
   * English Wiktionary, where the sense is sourced to a published dictionary
   * (Benson 1964, Barlow 1960, Hinde 1904).
   *
   * `baba` and `cũcũ` are glossed there as "my father" and "my grandmother",
   * not "father" and "grandmother": the possessive is part of the word. That
   * is recorded as it stands rather than tidied into the bare English noun,
   * and the `note` says so — trimming it would be inventing a claim about
   * Gĩkũyũ that the source does not make.
   */
  {
    id: "gikuyu:mwana",
    languageId: "gikuyu",
    term: "mwana",
    conceptId: "CHILD",
    meaning: "child",
    note: "Plural: ciana.",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/mwana", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:murata",
    languageId: "gikuyu",
    term: "mũrata",
    conceptId: "FRIEND",
    meaning: "friend",
    note: "Plural: arata. “Mũrata wakwa” is “my friend”.",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/mũrata", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:baba",
    languageId: "gikuyu",
    term: "baba",
    conceptId: "MY_FATHER",
    meaning: "my father",
    note: "Wiktionary glosses this as “my father”, not “father” — the possessive is built in.",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/baba", license: "CC BY-SA 4.0" },
    verified: false,
  },
  {
    id: "gikuyu:cucu",
    languageId: "gikuyu",
    term: "cũcũ",
    conceptId: "MY_GRANDMOTHER",
    meaning: "my grandmother",
    note: "Glossed as “my grandmother”. Plural: macũcũ.",
    source: { title: "English Wiktionary", url: "https://en.wiktionary.org/wiki/cũcũ", license: "CC BY-SA 4.0" },
    verified: false,
  },
];

/** Prefers the learner's language; falls back to the whole pool. */
export function wordOfDay(languageId: string | undefined, dayIndex: number): SeedWord {
  const own = seedWords.filter((w) => w.languageId === languageId);
  const pool = own.length > 0 ? own : seedWords;
  return pool[dayIndex % pool.length];
}
