// Placeholder Word of the Day pool until the `vocabulary` table is populated
// from Kencorpus / Common Voice. Entries are common Kiswahili words, kept
// `verified: false` and shown with a "seed data" label in the UI.

export type SeedWord = {
  id: string;
  languageId: string;
  term: string;
  meaning: string;
  example: string;
  exampleMeaning: string;
  note?: string;
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
];

/** Prefers the learner's language; falls back to the whole pool. */
export function wordOfDay(languageId: string | undefined, dayIndex: number): SeedWord {
  const own = seedWords.filter((w) => w.languageId === languageId);
  const pool = own.length > 0 ? own : seedWords;
  return pool[dayIndex % pool.length];
}
