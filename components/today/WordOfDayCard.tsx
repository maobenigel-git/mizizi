import { PronunciationButton } from "@/components/pronunciation/PronunciationButton";
import type { Word } from "@/lib/db/vocabulary";
import { toggleNotebook } from "@/lib/session/actions";

/** Body shared by the Today card and the once-a-day popup. */
export function WordOfDayBody({ word, languageName, saved }: { word: Word; languageName: string; saved: boolean }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-muted">Word of the day</h2>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{languageName}</span>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <p className="text-3xl font-semibold tracking-tight">{word.term}</p>
          <p className="text-muted">{word.meaning}</p>
        </div>
        <PronunciationButton term={word.term} audioUrl={word.audioUrl} phonetic={word.phonetic} />
      </div>
      <blockquote className="border-l-2 border-accent pl-3 text-sm">
        <p>{word.example}</p>
        <p className="text-muted">{word.exampleMeaning}</p>
      </blockquote>
      {word.note && <p className="text-sm text-muted">{word.note}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <form action={toggleNotebook.bind(null, word.id, "word_of_day")}>
          <button
            type="submit"
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors duration-200 ease-out ${saved ? "border-accent bg-accent-solid text-white" : "border-accent text-accent hover:bg-accent/10"}`}
          >
            {saved ? "Saved to notebook" : "Save to notebook"}
          </button>
        </form>
        {!word.verified && <span className="text-xs text-muted">Seed data · awaiting verification</span>}
      </div>
    </>
  );
}

export function WordOfDayCard(props: { word: Word; languageName: string; saved: boolean }) {
  return (
    <section className="glass space-y-4 p-5">
      <WordOfDayBody {...props} />
    </section>
  );
}
