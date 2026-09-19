import { onboardingButton, onboardingInput } from "@/components/onboarding/styles";
import { saveAccount } from "@/lib/session/actions";
import { getSession } from "@/lib/session";

export default async function AccountPage() {
  const { contact } = await getSession();
  return (
    <form action={saveAccount} className="flex flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted">Your phone number keeps your streak safe across devices.</p>
      </header>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Phone number or email</span>
        <input name="contact" required autoComplete="username" placeholder="07XX XXX XXX" defaultValue={contact} className={onboardingInput} />
      </label>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" className={onboardingInput} />
      </label>
      <div className="mt-auto space-y-3">
        <button type="submit" className={onboardingButton}>
          Continue
        </button>
        <button type="button" disabled className="w-full rounded-xl border-2 border-border px-6 py-3 text-sm font-medium text-muted">
          Continue with Google · coming soon
        </button>
      </div>
    </form>
  );
}
