import { families, languages } from "@/data/languages/registry";
import type { Language, LanguageFamily } from "@/types";

// Reads from the seed registry for now. When Postgres is wired up, swap these
// bodies for queries against the `languages` table — callers stay the same.

export async function listLanguages(): Promise<Language[]> {
  return [...languages].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLanguage(id: string): Promise<Language | undefined> {
  return languages.find((l) => l.id === id);
}

export async function listFamilies(): Promise<LanguageFamily[]> {
  return families;
}

export async function listVarieties(parentId: string): Promise<Language[]> {
  return languages.filter((l) => l.parentId === parentId);
}
