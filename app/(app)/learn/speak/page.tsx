import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpeakingLesson } from "@/components/lessons/SpeakingLesson";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { getSpeakingLesson } from "@/lib/lessons/speaking";
import { countNotes } from "@/lib/db/notes";
import { getSession } from "@/lib/session";
import { completeLesson } from "@/lib/session/actions";

export const metadata: Metadata = { title: "Speaking practice · Mizizi" };

export default async function SpeakPage() {
  const session = await getSession();
  if (!session.languageId) notFound();
  const noteCount = session.userId ? await countNotes(session.userId) : 0;

  const [language, lesson] = await Promise.all([
    getLanguage(session.languageId),
    getSpeakingLesson(session.languageId),
  ]);

  return (
    <SpeakingLesson
      lesson={lesson}
      languageName={language?.name ?? session.languageId}
      character={characterFor(session.languageId)}
      noteCount={noteCount}
      complete={completeLesson.bind(null, "speaking")}
    />
  );
}
