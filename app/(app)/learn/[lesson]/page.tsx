import { notFound } from "next/navigation";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";
import { getLesson } from "@/lib/lessons/orientation";
import { getSession } from "@/lib/session";
import { completeLesson } from "@/lib/session/actions";

export default async function LessonPage({ params }: PageProps<"/learn/[lesson]">) {
  const [{ lesson: slug }, session] = await Promise.all([params, getSession()]);
  const lesson = session.languageId ? getLesson(session.languageId, slug) : undefined;
  if (!lesson) notFound();

  return <LessonPlayer lesson={lesson} complete={completeLesson.bind(null, lesson.slug)} exitHref="/learn" />;
}
