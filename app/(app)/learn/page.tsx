import type { Metadata } from "next";
import Link from "next/link";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { LessonPath } from "@/components/lessons/LessonPath";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { learnerPath } from "@/lib/lessons/progress";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Learn · Mizizi" };

/** Levels rendered on first paint, either side of the learner's current one; the rest load on scroll. */
const WINDOW = 20;

export default async function LearnPage({ searchParams }: PageProps<"/learn">) {
  const [{ completed }, session] = await Promise.all([searchParams, getSession()]);
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  if (!language) {
    return (
      <p className="glass mx-auto max-w-md p-8 text-center text-muted">
        Choose a language in your <Link href="/profile" className="font-medium text-accent hover:underline">profile</Link> to see your path.
      </p>
    );
  }

  const path = await learnerPath(session, language.id);
  const from = Math.max(1, path.current - WINDOW);
  const initial = path.levels.slice(from - 1, path.current + WINDOW);
  const justCompleted = Number(completed);

  return (
    <div className="mx-auto w-full max-w-xl space-y-6">
      <header className="glass flex items-center gap-4 p-5">
        <CharacterImage src={characterFor(language.id)} name={`${language.name} character`} className="h-20 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{language.name}</h1>
          <p className="text-sm text-muted">
            Level {path.current} of {path.total} · {path.completedCount} completed
          </p>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--glass-inset-bg)]">
            <div
              className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out"
              style={{ width: `${(path.completedCount / Math.max(path.total, 1)) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <LessonPath
        languageId={language.id}
        total={path.total}
        current={path.current}
        from={from}
        initial={initial}
        justCompleted={Number.isInteger(justCompleted) && justCompleted > 0 ? justCompleted : null}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/practice" className="glass p-4 transition-colors duration-200 ease-out hover:border-accent">
          <span className="block font-medium">Talk to your tutor</span>
          <span className="block text-sm text-muted">Practise in conversation.</span>
        </Link>
        <Link href="/notebook" className="glass p-4 transition-colors duration-200 ease-out hover:border-accent">
          <span className="block font-medium">Notebook · {session.notebook.length} saved</span>
          <span className="block text-sm text-muted">Review the words you&apos;ve kept.</span>
        </Link>
      </div>
    </div>
  );
}
