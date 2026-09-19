import type { Metadata } from "next";
import Link from "next/link";
import { PronunciationButton } from "@/components/pronunciation/PronunciationButton";
import { getLanguage } from "@/lib/db/languages";
import { getWord, type Word } from "@/lib/db/vocabulary";
import { getSession } from "@/lib/session";
import { toggleNotebook } from "@/lib/session/actions";
import type { NotebookSource } from "@/lib/session/types";

export const metadata: Metadata = { title: "Notebook · Mizizi" };

const sourceLabels: Record<NotebookSource, string> = {
  word_of_day: "Word of the day",
  lesson: "Lesson",
  culture_article: "Culture article",
  translate: "Translate",
};

export default async function NotebookPage({ searchParams }: PageProps<"/notebook">) {
  const [{ source }, session] = await Promise.all([searchParams, getSession()]);
  const filter = typeof source === "string" && source in sourceLabels ? (source as NotebookSource) : undefined;

  const entries = session.notebook.filter((e) => !filter || e.source === filter);
  const words = (await Promise.all(entries.map(async (e) => ({ entry: e, word: await getWord(e.id) })))).filter(
    (row): row is { entry: (typeof entries)[number]; word: Word } => Boolean(row.word),
  );

  // Grouped by language: the notebook is cross-language by design.
  const groups = new Map<string, typeof words>();
  for (const row of words) groups.set(row.word.languageId, [...(groups.get(row.word.languageId) ?? []), row]);
  const usedSources = [...new Set(session.notebook.map((e) => e.source))];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Notebook</h1>
          <p className="text-muted">Everything you&apos;ve saved, across all your languages.</p>
        </div>
        {session.notebook.length > 0 && (
          <Link href="/notebook/review" className="rounded-xl bg-accent-solid px-5 py-2.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90">
            Quiz me on these
          </Link>
        )}
      </header>

      {usedSources.length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label="Filter by source">
          {[undefined, ...usedSources].map((s) => (
            <Link
              key={s ?? "all"}
              href={s ? `/notebook?source=${s}` : "/notebook"}
              className={`rounded-full border px-3 py-1 text-sm transition-colors duration-200 ease-out ${s === filter ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:border-accent"}`}
            >
              {s ? sourceLabels[s] : "All"}
            </Link>
          ))}
        </nav>
      )}

      {groups.size === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
          Nothing saved yet. Tap “Save to notebook” on the Word of the Day or in Translate.
        </p>
      ) : (
        await Promise.all(
          [...groups].map(async ([languageId, rows]) => (
            <section key={languageId} className="space-y-2">
              <h2 className="text-sm font-medium text-muted">{(await getLanguage(languageId))?.name ?? languageId}</h2>
              <ul className="glass divide-y divide-border">
                {rows.map(({ entry, word }) => (
                  <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                    <PronunciationButton term={word.term} audioUrl={word.audioUrl} phonetic={word.phonetic} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{word.term}</p>
                      <p className="text-sm text-muted">
                        {word.meaning} <span className="sm:hidden">· {sourceLabels[entry.source]}</span>
                      </p>
                    </div>
                    <span className="hidden rounded-full bg-border/60 px-2 py-0.5 text-xs text-muted sm:block">{sourceLabels[entry.source]}</span>
                    <form action={toggleNotebook.bind(null, entry.id, entry.source)}>
                      <button type="submit" aria-label={`Remove ${word.term}`} className="px-2 text-xl leading-none text-muted hover:text-red">
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          )),
        )
      )}
    </div>
  );
}
