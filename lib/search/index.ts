import { listBooks } from "@/lib/db/library";
import { listLanguages } from "@/lib/db/languages";
import { listVocabulary } from "@/lib/db/vocabulary";

// In-memory search across the knowledge graph. With Postgres this becomes
// full-text search + pgvector (docs/spec.md §1.16); the result shape stays.

export type SearchHit = {
  kind: "language" | "culture" | "book" | "word";
  title: string;
  detail: string;
  href: string;
};

export async function search(query: string): Promise<SearchHit[]> {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 1);
  if (terms.length === 0) return [];
  const matches = (...fields: (string | undefined)[]) => {
    const haystack = fields.filter(Boolean).join(" ").toLowerCase();
    return terms.some((t) => haystack.includes(t));
  };

  const [languages, books, words] = await Promise.all([listLanguages(), listBooks(), listVocabulary()]);
  const hits: SearchHit[] = [];

  for (const l of languages) {
    if (!matches(l.name, l.nativeName, l.iso639_3, l.description)) continue;
    hits.push({ kind: "language", title: l.name, detail: l.description, href: `/languages/${l.id}` });
    if (!l.parentId) {
      hits.push({ kind: "culture", title: `${l.name} culture and heritage`, detail: "Traditions, food, music, oral literature and more.", href: `/culture/${l.id}` });
    }
  }
  for (const b of books) {
    const related = languages.filter((l) => b.languageIds.includes(l.id)).map((l) => l.name);
    if (matches(b.title, b.author, b.summary, ...b.tags, ...b.concepts, ...related)) {
      hits.push({ kind: "book", title: b.title, detail: `${b.author}, ${b.year}`, href: `/literature/${b.id}` });
    }
  }
  for (const w of words) {
    if (matches(w.term, w.meaning)) {
      hits.push({ kind: "word", title: w.term, detail: `“${w.meaning}” in ${languages.find((l) => l.id === w.languageId)?.name}`, href: `/translate?q=${encodeURIComponent(w.term)}&from=${w.languageId}&to=english` });
    }
  }
  return hits.slice(0, 40);
}
