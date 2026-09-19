import { addDays } from "@/lib/session/streak";

const dayLetter = (date: string) =>
  new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" }).format(new Date(date));

/** Last 7 days, filled where the learner was active. Today is ringed. */
export function WeekStrip({ activity, today }: { activity: Record<string, number>; today: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <ol className="flex justify-between gap-1" aria-label="Activity over the last 7 days">
      {days.map((date) => {
        const active = (activity[date] ?? 0) > 0;
        return (
          <li key={date} className="flex flex-col items-center gap-1 text-xs text-muted">
            <span
              aria-label={`${date}: ${active ? "active" : "no activity"}`}
              className={`h-7 w-7 rounded-full border-2 ${active ? "border-gold bg-gold" : "border-border bg-transparent"} ${date === today ? "ring-2 ring-accent ring-offset-2 ring-offset-surface" : ""}`}
            />
            {dayLetter(date)}
          </li>
        );
      })}
    </ol>
  );
}
