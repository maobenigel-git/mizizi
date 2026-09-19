import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_COMPLETED, COOKIE_STEP, ONBOARDING_STEPS, SKIP_ONBOARDING } from "@/lib/session/types";

// Onboarding gate. Until `onboarding_completed` is set, every route redirects
// into the onboarding flow, and steps can only be reached in order. Afterwards
// the flow is closed and `/` lands on the home dashboard.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const inOnboarding = pathname === "/onboarding" || pathname.startsWith("/onboarding/");
  const redirectTo = (path: string) => NextResponse.redirect(new URL(path, request.url));

  // The gate is the only thing skipped: the session cookie is still empty, so
  // screens render in their signed-out-but-onboarded state.
  if (SKIP_ONBOARDING) return pathname === "/" ? redirectTo("/today") : NextResponse.next();

  if (request.cookies.get(COOKIE_COMPLETED)?.value === "true") {
    return inOnboarding || pathname === "/" ? redirectTo("/today") : NextResponse.next();
  }

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
