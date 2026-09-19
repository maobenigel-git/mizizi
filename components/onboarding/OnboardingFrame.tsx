"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScreenTransition } from "@/components/shell/ScreenTransition";
import { ONBOARDING_STEPS } from "@/lib/session/types";

/** Minimal chrome for the gated flow: back arrow + step progress, no app nav. */
export function OnboardingFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const index = ONBOARDING_STEPS.findIndex((step) => pathname === `/onboarding/${step}`);
  // Welcome has no chrome.
  const showProgress = index > 0;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6">
      <div className="flex h-8 items-center gap-3" style={{ viewTransitionName: "app-header" }}>
        {showProgress && (
          <>
            <Link
              href={`/onboarding/${ONBOARDING_STEPS[index - 1]}`}
              transitionTypes={["nav-back"]}
              aria-label="Back"
              className="text-xl leading-none text-muted hover:text-foreground"
            >
              ←
            </Link>
            <ol className="flex flex-1 gap-1.5" aria-label={`Step ${index} of 4`}>
              {[1, 2, 3, 4].map((step) => (
                <li
                  key={step}
                  className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ease-out ${step <= index ? "bg-ocean" : "bg-border"}`}
                />
              ))}
            </ol>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col pt-6">
        <ScreenTransition>{children}</ScreenTransition>
      </div>
    </div>
  );
}
