import { redirect } from "next/navigation";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";
import type { Lesson } from "@/lib/lessons/orientation";
import { getWord, listVocabulary, type Word } from "@/lib/db/vocabulary";
import { countNotes } from "@/lib/db/notes";
import { getSession } from "@/lib/session";
import { completeReview } from "@/lib/session/actions";

/** "Quiz me on these": a review session built only from the learner's saved items. */
export default async function NotebookReviewPage() {
  const session = await getSession();
  const noteCount = session.userId ? await countNotes(session.userId) : 0;
  const saved = (await Promise.all(session.notebook.map((e) => getWord(e.id)))).filter((w) => w !== undefined);
  if (saved.length === 0) redirect("/notebook");

  const pool = await listVocabulary();
  const lesson: Lesson = {
    id: "notebook:review",
    slug: "review",
    title: "Notebook review",
    summary: "Your saved words.",
    steps: saved.slice(-8).map((word, i) => {
      // Wrong answers are real meanings from the same language where it has
      // enough of them, topped up from the rest of the pool otherwise, so a
      // one-word language still gets a three-way question.
      const meanings = (words: Word[]) => [...new Set(words.map((w) => w.meaning))].filter((m) => m !== word.meaning);
      const own = meanings(pool.filter((w) => w.languageId === word.languageId));
      const rest = meanings(pool.filter((w) => w.languageId !== word.languageId));
      const distractors = [...own, ...rest];
      const picked = [...new Set([distractors[i % distractors.length], distractors[(i + 3) % distractors.length], distractors[(i + 1) % distractors.length]])]
        .filter((m): m is string => Boolean(m))
        .slice(0, 2);
      const options = [word.meaning, ...picked];
      const shift = i % options.length;
      const rotated = [...options.slice(shift), ...options.slice(0, shift)];
      return {
        kind: "choice" as const,
        prompt: `What does “${word.term}” mean?`,
        options: rotated,
        answer: rotated.indexOf(word.meaning),
        explain: word.example && word.exampleMeaning ? `${word.example} — ${word.exampleMeaning}` : word.note,
      };
    }),
  };

  return <LessonPlayer lesson={lesson} noteCount={noteCount} complete={completeReview} exitHref="/notebook" />;
}
