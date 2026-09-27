/** Ring showing lessons done today against the daily goal. `onHero` sits on the amber card. */
export function DailyGoal({ done, goal, onHero = false }: { done: number; goal: number; onHero?: boolean }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(done / goal, 1);
  const met = done >= goal;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className={onHero ? "stroke-white/45" : "stroke-gold/25"} />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className={`${onHero ? "stroke-white" : met ? "stroke-forest" : "stroke-gold"} transition-[stroke-dashoffset] duration-300 ease-out`}
        />
      </svg>
      <div>
        <p className="text-lg font-semibold">
          {Math.min(done, goal)} of {goal} lessons today
        </p>
        <p className={`text-sm ${onHero ? "opacity-85" : "text-muted"}`}>
          {met ? "Daily goal reached." : done === 0 ? "One lesson keeps your streak alive." : `${goal - done} to go.`}
        </p>
      </div>
    </div>
  );
}
