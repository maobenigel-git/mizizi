import { families, languages } from "@/data/languages/registry";
import { seedWords, type SeedWord } from "@/data/seed/word-of-day";
import type { Language } from "@/types";

// Orientation course: lessons generated purely from the language registry, so
// every language has something to learn on day one without inventing any
// vocabulary or translations. Real lessons replace these as verified content
// lands in the `lessons` tables.

export type LessonStep =
  | { kind: "info"; title: string; body: string }
  | {
      kind: "choice";
      prompt: string;
      options: string[];
      answer: number;
      explain?: string;
      /** The seeded word being tested, so the learner can save it to their notebook. */
      wordId?: string;
    };

export type Lesson = {
  /** `${languageId}:${slug}` */
  id: string;
  slug: string;
  title: string;
  summary: string;
  steps: LessonStep[];
};

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

/** Deterministic pick of `count` items, so a lesson is stable between visits. */
function pick<T>(items: T[], count: number, seed: number): T[] {
  if (items.length <= count) return items;
  const start = seed % items.length;
  return Array.from({ length: count }, (_, i) => items[(start + i * 7 + i) % items.length]).filter(
    (item, i, all) => all.indexOf(item) === i,
  );
}

function choice(prompt: string, correct: string, distractors: string[], seed: number, explain?: string): LessonStep {
  const unique = [...new Set(distractors.filter((d) => d !== correct))].slice(0, 2);
  const options = [correct, ...unique];
  const shift = seed % options.length;
  const rotated = [...options.slice(shift), ...options.slice(0, shift)];
  return { kind: "choice", prompt, options: rotated, answer: rotated.indexOf(correct), explain };
}

const coverageLabel = { full: "Full", developing: "Developing", heritage: "Heritage" } as const;

function meet(language: Language, seed: number): Lesson {
  const family = families.find((f) => f.id === language.family)!;
  return {
    id: `${language.id}:meet`,
    slug: "meet",
    title: `Meet ${language.name}`,
    summary: "Where it sits among Kenya's languages.",
    steps: [
      { kind: "info", title: language.name, body: language.description },
      choice(
        `Which language family does ${language.name} belong to?`,
        family.name,
        families.map((f) => f.name),
        seed,
        family.description,
      ),
      {
        kind: "info",
        title: "Honest coverage",
        body: "Data coverage varies by language. Full means complete lessons and audio, Developing means vocabulary and some audio, Heritage means a profile and sources only.",
      },
      choice(
        `What is ${language.name}'s coverage on Mizizi today?`,
        coverageLabel[language.coverage],
        Object.values(coverageLabel),
        seed + 1,
      ),
    ],
  };
}

function names(language: Language, seed: number): Lesson {
  const others = languages.filter((l) => l.id !== language.id);
  const steps: LessonStep[] = [];

  if (language.nativeName && language.nativeName !== language.name) {
    steps.push(
      { kind: "info", title: language.nativeName, body: `Speakers call ${language.name} “${language.nativeName}”.` },
      choice(
        `What do speakers call ${language.name}?`,
        language.nativeName,
        pick(others.filter((l) => l.nativeName && l.nativeName !== l.name), 2, seed).map((l) => l.nativeName!),
        seed,
      ),
    );
  }
  if (language.iso639_3) {
    steps.push(
      choice(
        `Which ISO 639-3 code identifies ${language.name}?`,
        language.iso639_3,
        pick(others.filter((l) => l.iso639_3), 2, seed + 3).map((l) => l.iso639_3!),
        seed + 2,
        "ISO 639-3 codes are how corpora and datasets label languages.",
      ),
    );
  }
  steps.push(
    choice(
      `Is ${language.name} listed as a single language or a cluster of related varieties?`,
      language.isCluster ? "A cluster of varieties" : "A single language",
      ["A cluster of varieties", "A single language"],
      seed + 4,
      "Some entries, like Luhya and Kalenjin, group several related varieties.",
    ),
  );

  return {
    id: `${language.id}:names`,
    slug: "names",
    title: "Names and codes",
    summary: "What it is called, and how datasets label it.",
    steps,
  };
}

function relatives(language: Language, seed: number): Lesson {
  const sameFamily = languages.filter((l) => l.family === language.family && l.id !== language.id);
  const otherFamily = languages.filter((l) => l.family !== language.family);
  const steps: LessonStep[] = [
    choice(
      `Which of these is in the same family as ${language.name}?`,
      pick(sameFamily, 1, seed)[0].name,
      pick(otherFamily, 2, seed + 5).map((l) => l.name),
      seed,
    ),
  ];

  const parent = languages.find((l) => l.id === language.parentId);
  if (parent) {
    steps.push(
      choice(
        `${language.name} is a variety within which cluster?`,
        parent.name,
        pick(languages.filter((l) => l.isCluster && l.id !== parent.id), 2, seed + 6).map((l) => l.name),
        seed + 1,
      ),
    );
  }
  const varieties = languages.filter((l) => l.parentId === language.id);
  if (varieties.length > 0) {
    steps.push(
      choice(
        `Which of these is a ${language.name} variety?`,
        pick(varieties, 1, seed)[0].name,
        pick(languages.filter((l) => l.parentId !== language.id && l.id !== language.id), 2, seed + 7).map((l) => l.name),
        seed + 2,
      ),
    );
  }

  return {
    id: `${language.id}:relatives`,
    slug: "relatives",
    title: "Relatives and neighbours",
    summary: "The languages closest to it.",
    steps,
  };
}

/*
 * Vocabulary lessons, built only from words actually seeded for the language.
 * Languages with no seeded words simply do not get one — the orientation
 * lessons above are generated from the registry and always exist.
 *
 * The pool is split into short lessons rather than one long one. A learner
 * meeting a language for the first time should finish something in a couple of
 * minutes, and the split is what lets new words arrive as a new lesson on the
 * path instead of quietly lengthening a lesson they already completed.
 *
 * This is derived from the seed pool, so it holds for every language: nothing
 * here knows which language it is looking at.
 */
const WORDS_PER_LESSON = 4;

function chunkWords(words: SeedWord[]): SeedWord[][] {
  const chunks: SeedWord[][] = [];
  for (let i = 0; i < words.length; i += WORDS_PER_LESSON) chunks.push(words.slice(i, i + WORDS_PER_LESSON));
  // A trailing chunk of one is a one-question lesson; fold it back rather than
  // putting that on the path.
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 2) {
    const tail = chunks.pop()!;
    chunks[chunks.length - 1].push(...tail);
  }
  return chunks;
}

function vocabulary(language: Language): Lesson[] {
  const all = seedWords.filter((w) => w.languageId === language.id);
  if (all.length < 2) return [];

  return chunkWords(all).map((chunk, index) => {
    const first = index === 0;
    const steps: LessonStep[] = [
      {
        kind: "info",
        title: first ? `Your first ${language.name} words` : `${chunk.length} more ${language.name} words`,
        body: first
          ? `${chunk.length} words, each one taken from a cited source rather than written by us. None has been checked by a ${language.name} speaker on Mizizi yet, so treat them as a starting point.`
          : `${chunk.length} more words from cited sources. Each one shows where it came from once you answer.`,
      },
    ];

    for (const word of chunk) {
      // Distractors are other real meanings from the same language — drawn from
      // the whole pool, not just this lesson — so a wrong answer is still a
      // real word rather than something invented.
      const others = all.filter((w) => w.id !== word.id).map((w) => w.meaning);
      const options = [word.meaning, ...pick(others, 2, hash(word.id))].sort();
      steps.push({
        kind: "choice",
        wordId: word.id,
        prompt: `What does “${word.term}” mean?`,
        options,
        answer: options.indexOf(word.meaning),
        explain: word.source
          ? `${word.term} — ${word.meaning}. ${word.note ? `${word.note} ` : ""}Source: ${word.source.title}.`
          : `${word.term} — ${word.meaning}.${word.note ? ` ${word.note}` : ""}`,
      });
    }

    // The first lesson keeps the slug "words" so paths already completed under
    // it stay completed when a language's pool grows past one lesson.
    const slug = first ? "words" : `words-${index + 1}`;
    return {
      id: `${language.id}:${slug}`,
      slug,
      title: first ? `First ${language.name} words` : index === 1 ? `More ${language.name} words` : `${language.name} words ${index + 1}`,
      summary: `${chunk.length} words to recognise.`,
      steps,
    };
  });
}

/*
 * The speaking level has no generated steps: its phrases are fetched by
 * lib/lessons/speaking when the level is opened (see lib/lessons/levels).
 */
function speaking(language: Language): Lesson {
  return {
    id: `${language.id}:speaking`,
    slug: "speaking",
    title: "Speaking practice",
    summary: "Hear a phrase, say it back.",
    steps: [],
  };
}

/** The generated course, in path order. lib/lessons/levels turns it into Levels 1…N. */
export function generatedCourse(languageId: string): Lesson[] {
  const language = languages.find((l) => l.id === languageId);
  if (!language) return [];
  const seed = hash(language.id);
  return [
    meet(language, seed),
    ...vocabulary(language),
    names(language, seed),
    relatives(language, seed),
    speaking(language),
  ];
}
