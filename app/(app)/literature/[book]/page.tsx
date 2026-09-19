import Link from "next/link";
import { notFound } from "next/navigation";
import { getLanguage } from "@/lib/db/languages";
import { categoryLabels, findBookUrl, getBook } from "@/lib/db/library";

export async function generateMetadata({ params }: PageProps<"/literature/[book]">) {
  const book = await getBook((await params).book);
  return { title: book ? `${book.title} · Mizizi` : "Not found" };
}

export default async function BookPage({ params }: PageProps<"/literature/[book]">) {
  const book = await getBook((await params).book);
  if (!book) notFound();
  const languages = (await Promise.all(book.languageIds.map(getLanguage))).filter((l) => l !== undefined);
  const rights = categoryLabels[book.category];

  return (
    <article className="max-w-2xl space-y-8">
      <header className="space-y-3">
        <Link href="/literature" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Literature
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{book.title}</h1>
        <p className="text-lg text-muted">{book.author}</p>
        <ul className="flex flex-wrap gap-2 text-xs font-medium">
          {[...book.tags, ...languages.map((l) => l.name), String(book.year)].map((tag) => (
            <li key={tag} className="rounded-full bg-accent/15 px-2.5 py-1 text-accent">
              {tag}
            </li>
          ))}
        </ul>
      </header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">About this book</h2>
        <p>{book.summary}</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Explore</h2>
        <ul className="flex flex-wrap gap-2">
          {book.concepts.map((concept) => (
            <li key={concept} className="glass !rounded-lg px-3 py-1.5 text-sm">
              {concept}
            </li>
          ))}
          {languages.map((l) => (
            <li key={l.id}>
              <Link
                href={`/culture/${l.id}`}
                className="block rounded-lg border border-accent px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
              >
                {l.name} culture →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="glass space-y-3 p-5">
        <p className="text-sm">
          <span className="font-semibold">{rights.label}.</span> {rights.access}
        </p>
        <a
          href={findBookUrl(book)}
          target="_blank"
          rel="noreferrer"
          className="inline-block rounded-xl bg-accent-solid px-5 py-2.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90"
        >
          Find this book ↗
        </a>
        {!book.verified && <p className="text-xs text-muted">Catalogue details awaiting verification.</p>}
      </section>
    </article>
  );
}
