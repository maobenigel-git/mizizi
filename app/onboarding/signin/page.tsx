import type { Metadata } from "next";
import Link from "next/link";
import { accountErrorMessage } from "@/components/onboarding/accountErrors";
import { onboardingButton, onboardingInput } from "@/components/onboarding/styles";
import { signIn } from "@/lib/session/actions";

export const metadata: Metadata = { title: "Sign in · Mizizi" };

export default async function SignInPage({ searchParams }: PageProps<"/onboarding/signin">) {
  const message = accountErrorMessage((await searchParams).error);

  return (
    <form action={signIn} className="flex flex-1 flex-col gap-6">
      <Link href="/onboarding/welcome" transitionTypes={["nav-back"]} aria-label="Back" className="-mt-12 text-xl leading-none text-muted hover:text-foreground">
        ←
      </Link>
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted">Sign in to pick up your streak where you left it.</p>
      </header>
      {message && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-red/10 px-4 py-3 text-sm text-red">
          {message}
        </p>
      )}
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Phone number or email</span>
        <input name="contact" required autoComplete="username" inputMode="email" placeholder="07XX XXX XXX" className={onboardingInput} />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" required autoComplete="current-password" className={onboardingInput} />
      </label>
      <div className="mt-auto space-y-3">
        <button type="submit" className={onboardingButton}>
          Sign in
        </button>
        <Link href="/onboarding/welcome" className="block w-full py-2 text-center text-sm font-medium text-ocean">
          New here? Get started
        </Link>
      </div>
    </form>
  );
}
