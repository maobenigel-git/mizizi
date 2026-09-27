/*
 * Start-up checks for a production server, run once per instance before it
 * takes a request (Next.js calls `register` on boot, not during `next build`).
 *
 * A missing SESSION_SECRET stops the server here, with the fix in the message,
 * rather than letting it serve pages and fail halfway through someone's
 * sign-up. A missing DATABASE_URL is only a warning: the app still works, but
 * accounts and notes will not survive a restart.
 */
export async function register() {
  if (process.env.NODE_ENV === "development" && process.env.NEXT_RUNTIME === "nodejs") {
    // The local API-setup screen needs this one-time link (lib/dev/setup-access).
    const { setupToken } = await import("./lib/dev/setup-access");
    console.log(`
  🔑 API setup: http://localhost:${process.env.PORT || 3000}/setup?token=${setupToken()}
`);
    return;
  }
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return;

  if ((process.env.SESSION_SECRET ?? "").length < 32) {
    throw new Error(
      "[mizizi] SESSION_SECRET must be set to a random string of at least 32 characters " +
        "(generate one with `openssl rand -base64 48`). See .env.example.",
    );
  }
  if (!process.env.DATABASE_URL) {
    console.warn(
      "[mizizi] DATABASE_URL is not set: accounts, synced progress and notes are held in memory and " +
        "will be lost on restart. Set DATABASE_URL before taking sign-ups.",
    );
  }
}
