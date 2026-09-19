import { redirect } from "next/navigation";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";
import type { Lesson } from "@/lib/lessons/orientation";
import { getWord, listVocabulary } from "@/lib/db/vocabulary";
import { getSession } from "@/lib/session";
import { completeReview } from "@/lib/session/actions";

/** "Quiz me on these": a review session built only from the learner's saved items. */
export default async function NotebookReviewPage() {
  const session = await getSession();
  const saved = (await Promise.all(session.notebook.map((e) => getWord(e.id)))).filter((w) => w !== undefined);
  if (saved.length === 0) redirect("/notebook");

  const pool = await listVocabulary();
  const lesson: Lesson = {
    id: "notebook:review",
    slug: "review",
    title: "Notebook review",
    summary: "Your saved words.",
    steps: saved.slice(-8).map((word, i) => {
      const distractors = pool.filter((w) => w.meaning !== word.meaning).map((w) => w.meaning);
      const picked = [distractors[i % distractors.length], distractors[(i + 3) % distractors.length]];
      const options = [...new Set([word.meaning, ...picked])];
      const shift = i % options.length;
      const rotated = [...options.slice(shift), ...options.slice(0, shift)];
      return {
        kind: "choice" as const,
        prompt: `What does “${word.term}” mean?`,
        options: rotated,
        answer: rotated.indexOf(word.meaning),
        explain: `${word.example} — ${word.exampleMeaning}`,
      };
    }),
  };

  return <LessonPlayer lesson={lesson} complete={completeReview} exitHref="/notebook" />;
}
