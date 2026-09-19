export function FlameIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.546 3.75 3.75 0 0 1 3.255 3.718Z"
      />
    </svg>
  );
}

/**
 * Streak counter for the nav. `atRisk` (evening, nothing done today) only
 * shifts the colour — no nagging copy in v1.
 */
export function StreakFlame({ count, atRisk, label = false }: { count: number; atRisk: boolean; label?: boolean }) {
  const lit = count > 0 && !atRisk;
  return (
    <span
      title={atRisk ? "No activity yet today" : `${count}-day streak`}
      className={`flex items-center gap-1 text-sm font-semibold transition-colors duration-200 ease-out ${lit ? "text-gold" : "text-white/50"}`}
    >
      <FlameIcon />
      {count}
      <span className={label ? "font-normal" : "sr-only"}> day streak</span>
    </span>
  );
}
