import type { Word } from "@/lib/db/vocabulary";
import { dismissWordOfDay } from "@/lib/session/actions";
import { WordOfDayBody } from "./WordOfDayCard";

/**
 * Once-a-day popup on first open (docs/spec.md §2.4). It sits in a corner as a
 * non-modal sheet, so it never blocks navigation; dismissing it records today's
 * date and it stays away until tomorrow.
 */
export function WordOfDayPopup(props: { word: Word; languageName: string; saved: boolean }) {
  return (
    <aside
      aria-label="Word of the day"
      className="fixed inset-x-3 bottom-20 z-40 animate-popup-in space-y-4 rounded-2xl border border-border bg-background p-5 shadow-2xl sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96"
    >
      <form action={dismissWordOfDay} className="-mt-2 -mr-2 -mb-2 flex justify-end">
        <button type="submit" aria-label="Dismiss word of the day" className="px-2 text-2xl leading-none text-muted hover:text-foreground">
          ×
        </button>
      </form>
      <WordOfDayBody {...props} />
    </aside>
  );
}
