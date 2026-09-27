// Best-effort, per-instance sliding-window limiters. They cap casual abuse; a
// shared store (Redis / Upstash) is the upgrade once traffic warrants it.

const HOUR_MS = 60 * 60 * 1000;

export function createLimiter(maxPerWindow: number, windowMs = HOUR_MS) {
  const hits = new Map<string, number[]>();
  return function allow(key: string, now = Date.now()): boolean {
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= maxPerWindow) {
      hits.set(key, recent);
      return false;
    }
    hits.set(key, [...recent, now]);
    if (hits.size > 5000) hits.clear();
    return true;
  };
}

/** Tutor messages per learner per hour. */
export const allowTutorRequest = createLimiter(40);

/** Sign-in attempts per contact per 15 minutes: enough for typos, not for guessing. */
export const allowSignInAttempt = createLimiter(10, 15 * 60 * 1000);

/** Scored recordings per learner per hour: each one is a paid speech-to-text call. */
export const allowPronunciationAttempt = createLimiter(60);
