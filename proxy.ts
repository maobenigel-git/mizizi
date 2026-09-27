import { NextResponse, type NextRequest } from "next/server";
import { unsign } from "@/lib/session/sign";
import { COOKIE_COMPLETED, COOKIE_SESSION, COOKIE_STEP, ONBOARDING_STEPS, SIGN_IN_PATH, SKIP_ONBOARDING } from "@/lib/session/types";

// Onboarding gate. Until `onboarding_completed` is set, every route redirects
// into the onboarding flow, and steps can only be reached in order. Afterwards
// the flow is closed and `/` lands on the home dashboard. Sign-in sits outside
// the step order: a returning learner can reach it from any step.

/** A completed flag is only good alongside a session that says what is being learned. */
function hasValidSession(request: NextRequest): boolean {
  const raw = request.cookies.get(COOKIE_SESSION)?.value;
  const session = raw ? unsign(raw) : undefined;
  return Boolean(session && typeof session === "object" && "languageId" in session && session.languageId);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const inOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // The local API-setup screen sits outside the app, before any account exists.
  // It 404s outside `next dev` and needs the terminal's token (lib/dev/setup-access).
  if (pathname === "/setup" && process.env.NODE_ENV === "development") return NextResponse.next();

  // The gate is the only thing skipped: the session cookie is still empty, so
  // screens render in their signed-out-but-onboarded state.
  if (SKIP_ONBOARDING) return pathname === "/" ? redirectTo("/today") : NextResponse.next();

  if (request.cookies.get(COOKIE_COMPLETED)?.value === "true") {
    if (hasValidSession(request)) {
      return inOnboarding || pathname === "/" ? redirectTo("/today") : NextResponse.next();
    }
    // Onboarded, but the session is gone or no longer verifies (an old unsigned
    // cookie, a rotated secret). Start over rather than render an app with no
    // language; a learner with an account signs back in from the welcome screen.
    const restart = redirectTo("/onboarding/welcome");
    for (const name of [COOKIE_COMPLETED, COOKIE_STEP, COOKIE_SESSION]) restart.cookies.delete(name);
    return restart;
  }

  if (pathname === SIGN_IN_PATH) return NextResponse.next();

  const stored = Number(request.cookies.get(COOKIE_STEP)?.value) || 0;
  const unlocked = Math.min(Math.max(stored, 0), ONBOARDING_STEPS.length - 1);
  const current = `/onboarding/${ONBOARDING_STEPS[unlocked]}`;
  if (!inOnboarding) return redirectTo(current);

  const requested = ONBOARDING_STEPS.findIndex((step) => pathname === `/onboarding/${step}`);
  return requested === -1 || requested > unlocked ? redirectTo(current) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|assets|_next/static|_next/image|favicon.ico).*)"],
};
