import type { Metadata } from "next";
import Link from "next/link";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { getCourse } from "@/lib/lessons/orientation";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Learn · Mizizi" };

export default async function LearnPage() {
  const session = await getSession();
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  const course = language ? getCourse(language.id) : [];
  const nextIndex = course.findIndex((l) => !session.completedLessons.includes(l.id));

  return (
    <div className="mx-auto w-full max-w-xl space-y-8">
      <header className="space-y-2">
        <CharacterImage src={characterFor(language?.id)} name={`${language?.name ?? ""} character`} className="h-40" />
        <h1 className="text-3xl font-semibold tracking-tight">{language?.name ?? "Your path"}</h1>
        <p className="text-muted">
          Orientation course. Full lessons arrive as verified {language?.name} content is added — data
          coverage varies by language.
        </p>
      </header>

      <ol className="space-y-3">
        {course.map((lesson, i) => {
          const done = session.completedLessons.includes(lesson.id);
          const current = i === nextIndex;
          const locked = !done && !current;
          const body = (
            <>
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${done ? "bg-forest text-white" : current ? "bg-accent-solid text-white" : "bg-border text-muted"}`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{lesson.title}</span>
                <span className="block text-sm text-muted">{lesson.summary}</span>
              </span>
              {current && <span className="text-sm font-medium text-accent">Start</span>}
              {done && <span className="text-sm text-muted">Review</span>}
            </>
          );
          const frame = `flex items-center gap-4 rounded-2xl border-2 bg-surface p-4 ${current ? "border-accent" : "border-border"}`;
          return (
            <li key={lesson.id}>
              {locked ? (
                <div className={`${frame} opacity-60`} aria-disabled>
                  {body}
                </div>
              ) : (
                <Link href={`/learn/${lesson.slug}`} className={`${frame} transition-colors duration-200 ease-out hover:border-accent`}>
                  {body}
                </Link>
              )}
            </li>
          );
        })}
      </ol>

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
