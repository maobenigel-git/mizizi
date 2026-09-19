import { onboardingButton, onboardingInput } from "@/components/onboarding/styles";
import { avatarStyles } from "@/components/shell/Avatar";
import { counties } from "@/data/seed/counties";
import { saveProfile } from "@/lib/session/actions";
import { getSession } from "@/lib/session";
import type { AvatarColor } from "@/lib/session/types";

export default async function ProfilePage() {
  const session = await getSession();
  const named = session.displayName !== "Learner";

  return (
    <form action={saveProfile} className="flex flex-1 flex-col gap-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">About you</h1>
        <p className="text-muted">This is how you&apos;ll appear in the app.</p>
      </header>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">Display name</span>
        <input name="displayName" required maxLength={40} autoComplete="nickname" defaultValue={named ? session.displayName : ""} className={onboardingInput} />
      </label>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Avatar colour</legend>
        <div className="flex gap-3">
          {(Object.keys(avatarStyles) as AvatarColor[]).map((color) => (
            <label key={color} className="cursor-pointer">
              <input type="radio" name="avatar" value={color} defaultChecked={color === session.avatar} className="peer sr-only" />
              <span
                className={`block h-12 w-12 rounded-full ring-offset-2 ring-offset-background transition-shadow duration-200 ease-out peer-checked:ring-4 peer-checked:ring-gold peer-focus-visible:ring-4 ${avatarStyles[color]}`}
              />
              <span className="sr-only">{color}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="space-y-1.5">
        <span className="text-sm font-medium">
          Home county <span className="font-normal text-muted">(optional)</span>
        </span>
        <select name="county" defaultValue={session.county ?? ""} className={onboardingInput}>
          <option value="">Prefer not to say</option>
          {counties.map((county) => (
            <option key={county}>{county}</option>
          ))}
        </select>
      </label>
      <button type="submit" className={`${onboardingButton} mt-auto`}>
        Continue
      </button>
    </form>
  );
}
