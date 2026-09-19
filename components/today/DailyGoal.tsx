/** Ring showing lessons done today against the daily goal. */
export function DailyGoal({ done, goal }: { done: number; goal: number }) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(done / goal, 1);
  const met = done >= goal;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-border" />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="stroke-forest transition-[stroke-dashoffset] duration-300 ease-out"
        />
      </svg>
      <div>
        <p className="text-lg font-semibold">
          {Math.min(done, goal)} of {goal} lessons today
        </p>
        <p className="text-sm text-muted">
          {met ? "Daily goal reached." : done === 0 ? "One lesson keeps your streak alive." : `${goal - done} to go.`}
        </p>
      </div>
    </div>
  );
}
