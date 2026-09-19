import type { StreakState } from "./types";

// Streak rules (docs/spec.md §2.1): one increment per local calendar day, one
// freeze earned per 7-day streak (max 3 banked), a missed day burns a freeze or
// resets to 0, and `longest` never decreases.

const MAX_FREEZES = 3;
const DAY_MS = 86_400_000;

export function localDate(timeZone = "Africa/Nairobi", now = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(now);
}

export function localHour(timeZone = "Africa/Nairobi", now = new Date()): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hour12: false }).format(now),
  );
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

/** Applies any missed days, so a lapsed streak reads as 0 before today's activity. */
export function settleStreak(streak: StreakState, today: string): StreakState {
  if (!streak.lastActivityDate) return streak;
  const missed = daysBetween(streak.lastActivityDate, today) - 1;
  if (missed <= 0) return streak;
  if (streak.freezes >= missed) {
    return { ...streak, freezes: streak.freezes - missed, lastActivityDate: addDays(today, -1) };
  }
  return { ...streak, current: 0 };
}

export function recordActivity(
  streak: StreakState,
  today: string,
): { streak: StreakState; incremented: boolean } {
  const settled = settleStreak(streak, today);
  if (settled.lastActivityDate === today) return { streak: settled, incremented: false };

  const current = settled.current + 1;
  return {
    incremented: true,
    streak: {
      current,
      longest: Math.max(settled.longest, current),
      freezes: current % 7 === 0 ? Math.min(MAX_FREEZES, settled.freezes + 1) : settled.freezes,
      lastActivityDate: today,
    },
  };
}
