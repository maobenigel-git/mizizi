import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SpeakingLesson } from "@/components/lessons/SpeakingLesson";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { getSpeakingLesson } from "@/lib/lessons/speaking";
import { getSession } from "@/lib/session";
import { completeLesson } from "@/lib/session/actions";

export const metadata: Metadata = { title: "Speaking practice · Mizizi" };

export default async function SpeakPage() {
  const session = await getSession();
  if (!session.languageId) notFound();

  const [language, lesson] = await Promise.all([
    getLanguage(session.languageId),
    getSpeakingLesson(session.languageId),
  ]);

  return (
    <SpeakingLesson
      lesson={lesson}
      languageName={language?.name ?? session.languageId}
      character={characterFor(session.languageId)}
      complete={completeLesson.bind(null, "speaking")}
    />
  );
}
