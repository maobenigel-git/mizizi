import { seedWords, type SeedWord } from "@/data/seed/word-of-day";

// Reads the seed pool for now; swap for the `vocabulary` table later.

export type Word = SeedWord;

export async function listVocabulary(languageId?: string): Promise<Word[]> {
  return languageId ? seedWords.filter((w) => w.languageId === languageId) : seedWords;
}

export async function getWord(id: string): Promise<Word | undefined> {
  return seedWords.find((w) => w.id === id);
}
