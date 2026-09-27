import { addDays } from "@/lib/session/streak";

const dayLetter = (date: string) =>
  new Intl.DateTimeFormat("en", { weekday: "narrow", timeZone: "UTC" }).format(new Date(date));

/*
 * Last 7 days, filled amber where the learner was active; today is ringed.
 * `vertical` is the Home screen's column of lettered dots; the default is the
 * row with letters underneath (profile, panel).
 */
export function WeekStrip({
  activity,
  today,
  vertical = false,
}: {
  activity: Record<string, number>;
  today: string;
  vertical?: boolean;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  return (
    <ol
      className={vertical ? "flex flex-row justify-between gap-2 lg:flex-col lg:items-start lg:gap-3" : "flex justify-between gap-1"}
      aria-label="Activity over the last 7 days"
    >
      {days.map((date) => {
        const active = (activity[date] ?? 0) > 0;
        const ring = date === today ? "ring-2 ring-gold/60 ring-offset-2 ring-offset-background" : "";
        const dot = active ? "border-gold bg-gold text-[var(--on-hero)]" : "border-gold/60 bg-background text-foreground";
        return vertical ? (
          <li key={date}>
            <span
              aria-label={`${date}: ${active ? "active" : "no activity"}`}
              className={`grid h-8 w-8 place-items-center rounded-full border-2 text-xs font-semibold shadow-[0_4px_10px_-6px_var(--gold)] transition-colors duration-200 ease-out ${dot} ${ring}`}
            >
              {dayLetter(date)}
            </span>
          </li>
        ) : (
          <li key={date} className="flex flex-col items-center gap-1 text-xs text-muted">
            <span
              aria-label={`${date}: ${active ? "active" : "no activity"}`}
              className={`h-8 w-8 rounded-full border-2 transition-colors duration-200 ease-out ${active ? "border-gold bg-gold" : "border-gold/45 bg-background"} ${ring}`}
            />
            {dayLetter(date)}
          </li>
        );
      })}
    </ol>
  );
}
