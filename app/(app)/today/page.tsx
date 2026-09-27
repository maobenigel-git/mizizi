import type { Metadata } from "next";
import Link from "next/link";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { FlameIcon } from "@/components/shell/StreakFlame";
import { WeekStrip } from "@/components/shell/WeekStrip";
import { DailyGoal } from "@/components/today/DailyGoal";
import { FeatureRail } from "@/components/today/FeatureRail";
import { WordOfDayCard } from "@/components/today/WordOfDayCard";
import { wordOfDay } from "@/data/seed/word-of-day";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { learnerPath } from "@/lib/lessons/progress";
import { getSession } from "@/lib/session";
import { localDate, localHour } from "@/lib/session/streak";
import { DAILY_LESSON_GOAL } from "@/lib/session/types";

export const metadata: Metadata = { title: "Home · Mizizi" };

function greeting(hour: number) {
  if (hour < 12) return "Good morning";
  return hour < 17 ? "Good afternoon" : "Good evening";
}

export default async function TodayPage() {
  const session = await getSession();
  const today = localDate();
  const dayIndex = Math.floor(Date.parse(today) / 86_400_000);

  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  const path = language ? await learnerPath(session, language.id) : undefined;
  // The next level; once every level is done, a rotating one to review.
  const allDone = path !== undefined && path.total > 0 && path.completedCount === path.total;
  const suggested = path?.levels[(allDone ? dayIndex % path.total : path.current - 1)];
  const suggestion = suggested ? { level: suggested, review: allDone } : undefined;
  const word = wordOfDay(language?.id, dayIndex);
  const wordLanguage = await getLanguage(word.languageId);
  const lessonsToday = session.activity[today] ?? 0;
  const activeToday = session.streak.lastActivityDate === today;
  const isNew = (path?.completedCount ?? 0) === 0;

  const hill = (
    <svg aria-hidden viewBox="0 0 400 120" preserveAspectRatio="none" className="pointer-events-none absolute -bottom-px right-0 h-20 w-1/2">
      <path d="M0 120 C 140 90, 260 50, 400 40 L 400 120 Z" fill="var(--forest)" opacity="0.85" />
    </svg>
  );

  /*
   * Three columns on wide screens — explore rail · the day · streak — as in
   * the design. Phones get the day first, then the streak, then the rail.
   */
  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)_11rem] lg:gap-10">
      <div className="order-1 space-y-5 lg:order-2">
        <header>
          <p className="text-sm text-muted">
            {new Intl.DateTimeFormat("en-KE", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Nairobi" }).format(new Date())}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {isNew ? "Karibu" : greeting(localHour())}, {session.displayName.split(" ")[0]}
          </h1>
          {isNew && language && (
            <p className="mt-1">You&apos;re set up to learn {language.name}. Start your first lesson, or explore anything below.</p>
          )}
        </header>

        {suggestion && language && (
          <section className="relative flex min-h-72 flex-col justify-between gap-6 overflow-hidden rounded-[var(--radius-panel)] bg-[image:var(--hero-gradient)] p-6 text-[var(--on-hero)] shadow-[0_22px_44px_-20px_var(--red)] sm:p-7">
            {hill}
            <CharacterImage
              src={characterFor(language.id)}
              name={`${language.name} character`}
              className="pointer-events-none absolute -bottom-1 right-4 h-[92%] max-w-[40%]"
            />
            <div className="relative max-w-[60%] space-y-2">
              <p className="text-sm font-medium text-[var(--on-hero)]/80">
                {isNew ? "Your first lesson" : suggestion.review ? "Today's review" : lessonsToday > 0 ? "Up next" : "Today's lesson"} · {language.name}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                <span className="block text-sm font-medium text-[var(--on-hero)]/75">Level {suggestion.level.number}</span>
                {suggestion.level.title}
              </h2>
              <p className="text-[var(--on-hero)]/85">{suggestion.level.summary}</p>
            </div>
            <div className="relative flex flex-wrap items-center gap-4">
              <Link
                href={`/learn/${suggestion.level.number}`}
                className="press rounded-[var(--radius-control)] bg-white px-6 py-3 font-semibold text-forest shadow-[0_8px_20px_-10px_rgb(61_21_8/0.5)] transition-transform duration-200 ease-out hover:scale-[1.02]"
              >
                {isNew ? "Start" : "Continue"}
              </Link>
              <Link href="/learn" className="text-sm font-medium text-[var(--on-hero)] underline-offset-4 hover:underline">
                See your path
              </Link>
            </div>
          </section>
        )}

        <section className="relative overflow-hidden rounded-[var(--radius-panel)] bg-[image:var(--hero-gradient)] p-6 text-[var(--on-hero)] shadow-[0_18px_40px_-20px_var(--red)]">
          {hill}
          <div className="relative">
            <DailyGoal done={lessonsToday} goal={DAILY_LESSON_GOAL} onHero />
          </div>
        </section>

        {/* Until it is dismissed, today's word is shown by the popup instead. */}
        {session.wotdSeen === today && (
          <WordOfDayCard
            word={word}
            languageName={wordLanguage?.name ?? word.languageId}
            saved={session.notebook.some((e) => e.id === word.id)}
          />
        )}
      </div>

      <aside aria-label="Your streak" className="order-2 space-y-4 lg:order-3 lg:pt-32">
        <div className="flex items-start gap-3">
          <FlameIcon className={`h-10 w-10 shrink-0 ${activeToday || session.streak.current > 0 ? "text-gold" : "text-border"}`} />
          <div>
            <p className="text-xl font-semibold leading-tight">{session.streak.current}-day streak</p>
            <p className="text-sm">
              {activeToday ? "You've practised today." : "Complete a lesson to extend it."}
              {session.streak.freezes > 0 && ` ${session.streak.freezes} freeze${session.streak.freezes > 1 ? "s" : ""} banked.`}
            </p>
          </div>
        </div>
        <div className="lg:pl-1">
          <WeekStrip activity={session.activity} today={today} vertical />
        </div>
      </aside>

      <div className="order-3 lg:order-1">
        <FeatureRail />
      </div>
    </div>
  );
}
