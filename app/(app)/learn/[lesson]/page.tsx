import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { LessonRunner } from "@/components/lessons/LessonRunner";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { countNotes } from "@/lib/db/notes";
import { getLevel, levelForSlug, listLevels, toClient } from "@/lib/lessons/levels";
import { canOpenLevel } from "@/lib/lessons/progress";
import { getSession } from "@/lib/session";
import { recognizerFor } from "@/lib/speech/recognition";
import { canSynthesize } from "@/lib/speech/synthesis";
import { speechTagFor } from "@/lib/speech/voices";

export const metadata: Metadata = { title: "Lesson · Mizizi" };

/** /learn/3 — one level. Locked levels redirect to the path; old slug URLs to their level. */
export default async function LevelPage({ params }: PageProps<"/learn/[lesson]">) {
  const [{ lesson: param }, session] = await Promise.all([params, getSession()]);
  const languageId = session.languageId;
  if (!languageId) redirect("/learn");

  const number = Number(param);
  if (!Number.isInteger(number)) {
    // Bookmarks from before levels existed: /learn/words → /learn/2.
    const level = levelForSlug(languageId, param);
    if (level) redirect(`/learn/${level}`);
    notFound();
  }

  const [level, language, levels] = await Promise.all([getLevel(languageId, number), getLanguage(languageId), listLevels(languageId)]);
  if (!level || !language) notFound();
  // The lock is enforced here, not just drawn on the path.
  if (!(await canOpenLevel(session, languageId, number))) redirect("/learn");

  const [recognizer, canSpeak] = await Promise.all([recognizerFor(languageId), canSynthesize(languageId)]);
  const noteCount = session.userId ? await countNotes(session.userId) : 0;

  return (
    <LessonRunner
      key={level.id}
      level={{ number: level.number, title: level.title, summary: level.summary, kinds: level.kinds, exercises: level.exercises.map(toClient) }}
      total={levels.length}
      languageId={languageId}
      languageName={language.name}
      character={characterFor(languageId)}
      speech={{
        recognizer: recognizer.kind === "none" ? { kind: "none" } : recognizer,
        canSpeak,
        speechTag: speechTagFor(languageId),
        pass: level.requirements.pronunciationPass,
        attemptsToSkip: level.requirements.pronunciationAttemptsToSkip,
      }}
      noteCount={noteCount}
      savedWordIds={session.notebook.map((e) => e.id)}
    />
  );
}
