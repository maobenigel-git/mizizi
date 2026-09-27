import Link from "next/link";
import { accountErrorMessage } from "@/components/onboarding/accountErrors";
import { onboardingButton, onboardingInput } from "@/components/onboarding/styles";
import { saveAccount } from "@/lib/session/actions";
import { getSession } from "@/lib/session";
import { PASSWORD_MIN_LENGTH } from "@/lib/session/contact";
import { SIGN_IN_PATH } from "@/lib/session/types";

export default async function AccountPage({ searchParams }: PageProps<"/onboarding/account">) {
  const [{ error }, { contact }] = await Promise.all([searchParams, getSession()]);
  const message = accountErrorMessage(error);

  return (
    <form action={saveAccount} className="flex flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted">Your account keeps your streak and notes safe, and lets you sign in on another device.</p>
      </header>
      {message && (
        <p role="alert" className="rounded-[var(--radius-control)] bg-red/10 px-4 py-3 text-sm text-red">
          {message}{" "}
          {error === "taken" && (
            <Link href={SIGN_IN_PATH} className="font-semibold underline">
              Sign in instead
            </Link>
          )}
        </p>
      )}
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Phone number or email</span>
        <input name="contact" required autoComplete="username" inputMode="email" placeholder="07XX XXX XXX" defaultValue={contact} className={onboardingInput} />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" required minLength={PASSWORD_MIN_LENGTH} autoComplete="new-password" className={onboardingInput} />
        <span className="block text-xs text-muted">At least {PASSWORD_MIN_LENGTH} characters.</span>
      </label>
      <div className="mt-auto space-y-3">
        <button type="submit" className={onboardingButton}>
          Continue
        </button>
        <Link href={SIGN_IN_PATH} className="block w-full py-2 text-center text-sm font-medium text-ocean">
          I already have an account
        </Link>
      </div>
    </form>
  );
}
