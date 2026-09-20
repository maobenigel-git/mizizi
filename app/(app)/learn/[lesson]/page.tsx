import { notFound, redirect } from "next/navigation";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";
import { getLesson } from "@/lib/lessons/orientation";
import { countNotes } from "@/lib/db/notes";
import { getSession } from "@/lib/session";
import { completeLesson } from "@/lib/session/actions";

export default async function LessonPage({ params }: PageProps<"/learn/[lesson]">) {
  const [{ lesson: slug }, session] = await Promise.all([params, getSession()]);
  // "speaking" is in the course so completeLesson credits it, but it is
  // driven by lib/lessons/speaking, not by generated steps.
  if (slug === "speaking") redirect("/learn/speak");
  const lesson = session.languageId ? getLesson(session.languageId, slug) : undefined;
  if (!lesson) notFound();
  const noteCount = session.userId ? await countNotes(session.userId) : 0;

  return <LessonPlayer lesson={lesson} noteCount={noteCount} complete={completeLesson.bind(null, lesson.slug)} exitHref="/learn" />;
}
