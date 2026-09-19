import type { Metadata } from "next";
import Link from "next/link";
import { search } from "@/lib/search";

export const metadata: Metadata = { title: "Explore · Mizizi" };

const sections = [
  { href: "/languages", title: "Languages", detail: "Every language in the catalogue, grouped by family, with honest data coverage." },
  { href: "/culture", title: "Culture & heritage", detail: "History, food, music, festivals, oral traditions and proverbs, community by community." },
  { href: "/literature", title: "Literature", detail: "A rights-aware catalogue of Kenyan writing, linked to languages and cultures." },
  { href: "/community", title: "Community", detail: "Find fellow learners and speakers, and help grow your language's data." },
];

const kindLabels = { language: "Language", culture: "Culture", book: "Book", word: "Word" };

export default async function ExplorePage({ searchParams }: PageProps<"/explore">) {
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const hits = query ? await search(query) : [];

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Explore</h1>
        <form action="/explore" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search languages, cultures, books and words"
            aria-label="Search"
            className="glass-inset w-full px-4 py-3 outline-none transition-all duration-200 ease-out focus:border-accent"
          />
          <button type="submit" className="rounded-xl bg-accent-solid px-5 font-semibold text-white">
            Search
          </button>
        </form>
      </header>

      {query ? (
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-muted">
            {hits.length} result{hits.length === 1 ? "" : "s"} for “{query}”
          </h2>
          <ul className="glass divide-y divide-border">
            {hits.map((hit) => (
              <li key={hit.href + hit.kind}>
                <Link href={hit.href} className="flex items-center gap-3 px-4 py-3 hover:text-accent">
                  <span className="w-20 shrink-0 text-xs font-medium uppercase tracking-wide text-accent">{kindLabels[hit.kind]}</span>
                  <span className="min-w-0">
                    <span className="block font-medium">{hit.title}</span>
                    <span className="block truncate text-sm text-muted">{hit.detail}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {hits.length === 0 && <p className="text-muted">Nothing found. Data coverage varies by language.</p>}
        </section>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sections.map((s) => (
            <Link key={s.href} href={s.href} className="glass border-2 p-6 transition-colors duration-200 ease-out hover:border-accent">
              <h2 className="text-xl font-semibold text-accent">{s.title}</h2>
              <p className="mt-1 text-muted">{s.detail}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
