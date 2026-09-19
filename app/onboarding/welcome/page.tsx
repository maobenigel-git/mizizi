import { CharacterImage } from "@/components/assets/CharacterImage";
import { onboardingButton } from "@/components/onboarding/styles";
import { LOGO } from "@/lib/assets";
import { startOnboarding } from "@/lib/session/actions";

export default function WelcomePage() {
  return (
    <div className="flex flex-1 flex-col justify-between gap-10">
      <div className="flex flex-1 flex-col justify-center gap-4">
        <CharacterImage
          src={LOGO}
          name="Mizizi"
          className="h-44 self-start"
          fallback={<p className="text-5xl font-semibold tracking-tight text-ocean">Mizizi</p>}
        />
        <h1 className="text-2xl font-semibold tracking-tight">
          Learn Kenya&apos;s languages, a few minutes a day.
        </h1>
        <p className="text-muted">Lessons, culture and heritage, grounded in verified sources.</p>
      </div>
      <form action={startOnboarding} className="space-y-3">
        <button type="submit" className={onboardingButton}>
          Get started
        </button>
        <button type="submit" className="w-full py-2 text-sm font-medium text-ocean">
          I have an account
        </button>
      </form>
    </div>
  );
}
