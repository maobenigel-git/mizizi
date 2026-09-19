import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { characterFor } from "@/lib/assets";
import { facets, listArticles, relatedBooks } from "@/lib/db/culture";
import { getLanguage } from "@/lib/db/languages";

export async function generateMetadata({ params }: PageProps<"/culture/[language]">) {
  const language = await getLanguage((await params).language);
  return { title: language ? `${language.name} culture · Mizizi` : "Not found" };
}

export default async function CommunityCulturePage({ params }: PageProps<"/culture/[language]">) {
  const language = await getLanguage((await params).language);
  if (!language) notFound();
  const [articles, books] = await Promise.all([listArticles(language.id), relatedBooks(language.id)]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap-reverse items-center justify-between gap-6">
      <header className="min-w-0 flex-1 space-y-2">
        <Link href="/culture" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Culture &amp; heritage
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{language.name} cultural traditions</h1>
        <p className="text-muted">
          Language:{" "}
          <Link href={`/languages/${language.id}`} className="text-accent hover:underline">
            {language.name}
          </Link>
        </p>
      </header>
      <CharacterImage src={characterFor(language.id)} name={`${language.name} character`} className="h-64 shrink-0" />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {facets.map((facet) => {
          const items = articles.filter((a) => a.facet === facet.id);
          return (
            <div key={facet.id} className="glass space-y-1 p-4">
              <h2 className="font-semibold text-accent">{facet.title}</h2>
              {items.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {items.map((a) => (
                    <li key={a.id}>
                      {a.title} <span className="text-muted">· {a.source}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No sourced articles yet.</p>
              )}
            </div>
          );
        })}
      </section>

      <p className="rounded-2xl border border-dashed border-accent/50 p-5 text-sm">
        Know this culture?{" "}
        <Link href="/community/contribute" className="font-medium text-accent hover:underline">
          Share a proverb or help verify content →
        </Link>
      </p>

      {books.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">In literature</h2>
          <ul className="glass divide-y divide-border">
            {books.map((b) => (
              <li key={b.id}>
                <Link href={`/literature/${b.id}`} className="flex justify-between gap-3 px-4 py-3 hover:text-accent">
                  <span className="font-medium">{b.title}</span>
                  <span className="text-sm text-muted">
                    {b.author}, {b.year}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
