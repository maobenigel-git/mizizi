// Best-effort, per-instance limiter for the tutor endpoint. It caps casual
// abuse; a shared store (Redis / Upstash) is the upgrade once traffic warrants it.

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

export function allowRequest(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  if (hits.size > 5000) hits.clear();
  return true;
}
