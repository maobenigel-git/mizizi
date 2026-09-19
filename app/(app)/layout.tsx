import { AppShell } from "@/components/shell/AppShell";
import { WordOfDayPopup } from "@/components/today/WordOfDayPopup";
import { wordOfDay } from "@/data/seed/word-of-day";
import { getLanguage } from "@/lib/db/languages";
import { getSession } from "@/lib/session";
import { localDate, localHour } from "@/lib/session/streak";

/** Persistent shell for everything behind the onboarding gate (see proxy.ts). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  const today = localDate();

  const word = wordOfDay(language?.id, Math.floor(Date.parse(today) / 86_400_000));
  const wordLanguage = await getLanguage(word.languageId);

  return (
    <AppShell
      profile={{
        displayName: session.displayName,
        avatar: session.avatar,
        languageName: language?.name,
        level: session.level,
        county: session.county,
        streak: session.streak,
        streakAtRisk:
          session.streak.current > 0 && session.streak.lastActivityDate !== today && localHour() >= 18,
        xp: session.xp,
        activity: session.activity,
        today,
        notebookCount: session.notebook.length,
      }}
      popup={
        session.wotdSeen !== today && (
          <WordOfDayPopup
            word={word}
            languageName={wordLanguage?.name ?? word.languageId}
            saved={session.notebook.some((e) => e.id === word.id)}
          />
        )
      }
    >
      {children}
    </AppShell>
  );
}
