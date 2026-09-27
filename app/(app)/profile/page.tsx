import type { Metadata } from "next";
import Link from "next/link";
import { Avatar, avatarStyles } from "@/components/shell/Avatar";
import { FeatureGrid } from "@/components/shell/FeatureGrid";
import { FlameIcon } from "@/components/shell/StreakFlame";
import { WeekStrip } from "@/components/shell/WeekStrip";
import { counties } from "@/data/seed/counties";
import { countSubmissions } from "@/lib/db/contributions";
import { getLanguage, listLanguages } from "@/lib/db/languages";
import { countCompleted } from "@/lib/db/progress";
import { listLevels } from "@/lib/lessons/levels";
import { learnerPath } from "@/lib/lessons/progress";
import { getSession } from "@/lib/session";
import { getAchievements } from "@/lib/session/achievements";
import { resetSession, signOut, updateProfile } from "@/lib/session/actions";
import { localDate } from "@/lib/session/streak";
import type { AvatarColor } from "@/lib/session/types";

export const metadata: Metadata = { title: "Profile · Mizizi" };

const levelLabels = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
const field =
  "w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 outline-none transition-colors duration-200 ease-out focus:border-accent";

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const [{ saved }, session, languages] = await Promise.all([searchParams, getSession(), listLanguages()]);
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  // Imports any pre-levels progress for the current language before counting.
  const path = language ? await learnerPath(session, language.id) : undefined;
  const completedByLanguage = session.userId ? await countCompleted(session.userId) : {};
  const lessonsDone = Object.values(completedByLanguage).reduce((a, b) => a + b, 0);
  const contributions = session.userId ? await countSubmissions(session.userId) : 0;
  const achievements = getAchievements(
    session,
    { lessonsDone, courseDone: path?.completedCount ?? 0, courseLength: path?.total ?? 0 },
    contributions,
  );

  // Every language the learner has started, for the "Your courses" list.
  const courseIds = [...new Set([...(language ? [language.id] : []), ...Object.keys(completedByLanguage)])];
  const courses = (
    await Promise.all(
      courseIds.map(async (id) => {
        const [l, levels] = await Promise.all([getLanguage(id), listLevels(id)]);
        return l ? { language: l, total: levels.length, done: completedByLanguage[id] ?? 0 } : undefined;
      }),
    )
  ).filter((c) => c !== undefined);

  const stats = [
    { label: "Day streak", value: session.streak.current, flame: true },
    { label: "Total XP", value: session.xp },
    { label: "Levels done", value: lessonsDone },
    { label: "Longest streak", value: session.streak.longest },
    { label: "Streak freezes", value: session.streak.freezes },
    { label: "Words saved", value: session.notebook.length },
  ];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center gap-5">
        <Avatar name={session.displayName} color={session.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl font-semibold tracking-tight">{session.displayName}</h1>
          <p className="text-muted">
            {[
              language && `Learning ${language.name}`,
              session.level && levelLabels[session.level],
              session.county && `${session.county} County`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {session.joinedAt && (
            <p className="text-sm text-muted">
              Joined {new Intl.DateTimeFormat("en-KE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(session.joinedAt))}
            </p>
          )}
        </div>
      </header>

      {saved && (
        <p role="status" className="animate-fade-in rounded-xl border border-forest bg-forest/10 px-4 py-3 text-sm font-medium text-forest">
          Profile updated.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Statistics</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="glass flex items-center gap-3 p-4">
              {stat.flame && <FlameIcon className="h-7 w-7 text-gold" />}
              <div>
                <dd className="text-2xl font-semibold leading-tight">{stat.value}</dd>
                <dt className="text-sm text-muted">{stat.label}</dt>
              </div>
            </div>
          ))}
        </dl>
        <div className="glass p-5">
          <h3 className="mb-3 text-sm font-medium text-muted">This week</h3>
          <WeekStrip activity={session.activity} today={localDate()} />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your courses</h2>
        <ul className="space-y-3">
          {courses.map(({ language: l, total, done }) => (
            <li key={l.id} className="glass p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {l.name}
                  {l.id === language?.id && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Current</span>}
                </p>
                <p className="text-sm text-muted">
                  {done} of {total} levels
                </p>
              </div>
              <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full bg-forest" style={{ width: `${(done / Math.max(total, 1)) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
        <Link href="/learn" className="inline-block text-sm font-medium text-accent hover:underline">
          {(path?.completedCount ?? 0) === 0 ? "Start your first level →" : "Continue learning →"}
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          Achievements{" "}
          <span className="text-sm font-normal text-muted">
            {achievements.filter((a) => a.unlocked).length} of {achievements.length}
          </span>
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {achievements.map((a) => (
            <li key={a.id} className={`flex items-center gap-4 rounded-2xl border p-4 ${a.unlocked ? "border-gold bg-gold/10" : "border-border bg-surface"}`}>
              <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xl ${a.unlocked ? "bg-gold text-white" : "bg-border text-muted"}`} aria-hidden>
                {a.unlocked ? "★" : "☆"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted">{a.detail}</p>
                {!a.unlocked && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${a.progress * 100}%` }} />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Everything in Mizizi</h2>
        <FeatureGrid />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Edit profile</h2>
        <form action={updateProfile} className="glass grid gap-4 p-5 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Display name</span>
            <input name="displayName" required maxLength={40} defaultValue={session.displayName} className={field} />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Home county</span>
            <select name="county" defaultValue={session.county ?? ""} className={field}>
              <option value="">Prefer not to say</option>
              {counties.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Learning</span>
            <select name="languageId" defaultValue={session.languageId} className={field}>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Level</span>
            <select name="level" defaultValue={session.level} className={field}>
              {Object.entries(levelLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-sm font-medium">Avatar colour</legend>
            <div className="flex gap-3">
              {(Object.keys(avatarStyles) as AvatarColor[]).map((color) => (
                <label key={color} className="cursor-pointer">
                  <input type="radio" name="avatar" value={color} defaultChecked={color === session.avatar} className="peer sr-only" />
                  <span className={`block h-10 w-10 rounded-full ring-offset-2 ring-offset-surface transition-shadow duration-200 ease-out peer-checked:ring-4 peer-checked:ring-gold peer-focus-visible:ring-4 ${avatarStyles[color]}`} />
                  <span className="sr-only">{color}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="rounded-xl bg-accent-solid px-5 py-2.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 sm:col-span-2 sm:w-fit">
            Save changes
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <div className="glass space-y-4 p-5">
          {session.accountId ? (
            <p className="text-sm text-muted">
              Signed in as <span className="font-medium text-foreground">{session.contact}</span>. Your progress is saved to
              your account.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Your progress is kept on this device only. Signing out resets it.
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            {session.accountId && (
              <form action={signOut}>
                <button type="submit" className="press rounded-xl border border-border px-5 py-2.5 text-sm font-medium transition-colors duration-200 ease-out hover:border-accent hover:text-accent">
                  Sign out
                </button>
              </form>
            )}
            <form action={resetSession}>
              <button type="submit" className="press rounded-xl border border-border px-5 py-2.5 text-sm text-muted transition-colors duration-200 ease-out hover:border-red hover:text-red">
                {session.accountId ? "Reset all progress" : "Sign out and reset progress"}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
