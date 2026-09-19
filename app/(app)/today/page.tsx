import type { Metadata } from "next";
import Link from "next/link";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { FeatureGrid } from "@/components/shell/FeatureGrid";
import { FlameIcon } from "@/components/shell/StreakFlame";
import { WeekStrip } from "@/components/shell/WeekStrip";
import { DailyGoal } from "@/components/today/DailyGoal";
import { WordOfDayCard } from "@/components/today/WordOfDayCard";
import { wordOfDay } from "@/data/seed/word-of-day";
import { characterFor } from "@/lib/assets";
import { getLanguage } from "@/lib/db/languages";
import { suggestLesson } from "@/lib/lessons/orientation";
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
  const suggestion = language ? suggestLesson(language.id, session.completedLessons, dayIndex) : undefined;
  const word = wordOfDay(language?.id, dayIndex);
  const wordLanguage = await getLanguage(word.languageId);
  const lessonsToday = session.activity[today] ?? 0;
  const activeToday = session.streak.lastActivityDate === today;
  const isNew = session.completedLessons.length === 0;

  return (
    <div className="space-y-6">
      <header className="w-fit rounded-2xl bg-background/85 px-4 py-3 backdrop-blur-sm">
        <p className="text-sm text-muted">
          {new Intl.DateTimeFormat("en-KE", { weekday: "long", day: "numeric", month: "long", timeZone: "Africa/Nairobi" }).format(new Date())}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {isNew ? "Karibu" : greeting(localHour())}, {session.displayName.split(" ")[0]}
        </h1>
        {isNew && language && (
          <p className="mt-1 text-muted">
            You&apos;re set up to learn {language.name}. Start your first lesson, or explore anything below.
          </p>
        )}
      </header>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        {suggestion && language && (
          <section className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-2xl bg-accent-solid p-6 text-white lg:row-span-2">
            <CharacterImage
              src={characterFor(language.id)}
              name={`${language.name} character`}
              className="pointer-events-none absolute -bottom-2 right-2 h-[85%] max-w-[45%]"
            />
            <div className="relative max-w-[60%] space-y-2">
              <p className="text-sm text-white/75">
                {isNew ? "Your first lesson" : suggestion.review ? "Today's review" : lessonsToday > 0 ? "Up next" : "Today's lesson"} · {language.name}
              </p>
              <h2 className="text-2xl font-semibold tracking-tight">{suggestion.lesson.title}</h2>
              <p className="text-white/85">{suggestion.lesson.summary}</p>
            </div>
            <div className="relative flex flex-wrap items-center gap-4">
              <Link
                href={`/learn/${suggestion.lesson.slug}`}
                className="rounded-xl bg-white px-6 py-3 font-semibold text-ocean-dark transition-transform duration-200 ease-out hover:scale-[1.02]"
              >
                {session.completedLessons.length > 0 ? "Continue" : "Start"}
              </Link>
              <Link href="/learn" className="text-sm text-white/85 underline-offset-4 hover:underline">
                See your path
              </Link>
            </div>
          </section>
        )}

        <section className="glass space-y-4 p-5">
          <div className="flex items-center gap-3">
            <FlameIcon className={`h-10 w-10 ${activeToday ? "text-gold" : "text-border"}`} />
            <div>
              <p className="text-2xl font-semibold leading-tight">{session.streak.current}-day streak</p>
              <p className="text-sm text-muted">
                {activeToday ? "You've practised today." : "Complete a lesson to extend it."}
                {session.streak.freezes > 0 && ` ${session.streak.freezes} freeze${session.streak.freezes > 1 ? "s" : ""} banked.`}
              </p>
            </div>
          </div>
          <WeekStrip activity={session.activity} today={today} />
        </section>

        <section className="glass p-5">
          <DailyGoal done={lessonsToday} goal={DAILY_LESSON_GOAL} />
        </section>
      </div>

      <section className="space-y-3">
        <h2 className="w-fit rounded-xl bg-background/85 px-3 py-1 text-lg font-semibold backdrop-blur-sm">Explore Mizizi</h2>
        <FeatureGrid />
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
  );
}
