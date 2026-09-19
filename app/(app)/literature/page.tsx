import type { Metadata } from "next";
import Link from "next/link";
import { categoryLabels, listBooks } from "@/lib/db/library";

export const metadata: Metadata = { title: "Literature · Mizizi" };

export default async function LiteraturePage() {
  const books = await listBooks();
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/explore" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Explore
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Learn through Kenyan literature</h1>
        <p className="max-w-2xl text-muted">
          A rights-aware catalogue. Books in copyright appear as catalogue entries with topics to explore, never as
          hosted text.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {books.map((book) => (
          <li key={book.id}>
            <Link
              href={`/literature/${book.id}`}
              className="glass flex h-full flex-col gap-2 p-5 transition-colors duration-200 ease-out hover:border-accent"
            >
              <span className="text-lg font-semibold leading-snug">{book.title}</span>
              <span className="text-sm text-muted">
                {book.author} · {book.year}
              </span>
              <span className="text-sm">{book.summary}</span>
              <span className="mt-auto w-fit rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                {categoryLabels[book.category].label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
