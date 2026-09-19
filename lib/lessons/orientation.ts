import { families, languages } from "@/data/languages/registry";
import type { Language } from "@/types";

// Orientation course: lessons generated purely from the language registry, so
// every language has something to learn on day one without inventing any
// vocabulary or translations. Real lessons replace these as verified content
// lands in the `lessons` tables.

export type LessonStep =
  | { kind: "info"; title: string; body: string }
  | { kind: "choice"; prompt: string; options: string[]; answer: number; explain?: string };

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

export function getCourse(languageId: string): Lesson[] {
  const language = languages.find((l) => l.id === languageId);
  if (!language) return [];
  const seed = hash(language.id);
  return [meet(language, seed), names(language, seed), relatives(language, seed)];
}

export function getLesson(languageId: string, slug: string): Lesson | undefined {
  return getCourse(languageId).find((l) => l.slug === slug);
}

/** First unfinished lesson, or a rotating review once the course is done. */
export function suggestLesson(languageId: string, completed: string[], dayIndex: number) {
  const course = getCourse(languageId);
  if (course.length === 0) return undefined;
  const next = course.find((l) => !completed.includes(l.id));
  return next ? { lesson: next, review: false } : { lesson: course[dayIndex % course.length], review: true };
}
