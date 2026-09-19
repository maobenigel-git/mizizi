import { listBooks } from "@/lib/db/library";
import { listLanguages } from "@/lib/db/languages";

// Culture knowledge graph (docs/spec.md §1.9). The facets are the graph's
// shape; articles arrive only with a cited source, so every facet starts empty
// rather than being filled with unsourced claims.

export const facets = [
  { id: "history", title: "History" },
  { id: "food", title: "Food" },
  { id: "clothing", title: "Clothing" },
  { id: "music", title: "Music & dance" },
  { id: "festivals", title: "Festivals" },
  { id: "oral_traditions", title: "Oral traditions" },
  { id: "proverbs", title: "Proverbs" },
  { id: "crafts", title: "Crafts" },
  { id: "names", title: "Names" },
  { id: "geography", title: "Geography" },
  { id: "people", title: "Notable people" },
] as const;

export type CulturalArticle = {
  id: string;
  languageId: string;
  facet: (typeof facets)[number]["id"];
  title: string;
  body: string;
  source: string;
  communityValidated: boolean;
};

const articles: CulturalArticle[] = [];

/** Communities are keyed by their language; varieties sit under their cluster. */
export async function listCommunities() {
  return (await listLanguages()).filter((l) => !l.parentId);
}

export async function listArticles(languageId: string): Promise<CulturalArticle[]> {
  return articles.filter((a) => a.languageId === languageId);
}

export async function relatedBooks(languageId: string) {
  return (await listBooks()).filter((b) => b.languageIds.includes(languageId));
}
