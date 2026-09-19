import type { Metadata } from "next";
import { TutorChat } from "@/components/tutor/TutorChat";
import { tutorConfigured } from "@/lib/ai/tutor";
import { getLanguage } from "@/lib/db/languages";
import { getSession } from "@/lib/session";

export const metadata: Metadata = { title: "Tutor · Mizizi" };

export default async function PracticePage() {
  const session = await getSession();
  const language = session.languageId ? await getLanguage(session.languageId) : undefined;
  const name = language?.name ?? "language";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">{name} tutor</h1>
        <p className="text-sm text-muted">
          The tutor teaches only from checked {name} data. When it has no verified translation it will say so rather
          than guess.
        </p>
      </header>
      {tutorConfigured ? (
        <TutorChat
          languageName={name}
          starters={[`Teach me a greeting in ${name}`, "Quiz me on what I know", `What can you teach me in ${name} today?`]}
        />
      ) : (
        <div className="glass space-y-2 p-8 text-center">
          <p className="text-muted">The tutor is not connected on this server yet.</p>
          <p className="text-sm text-muted">
            Set <code className="rounded bg-[var(--glass-inset-bg)] px-1.5 py-0.5 font-mono text-xs">ANTHROPIC_API_KEY</code> in{" "}
            <code className="rounded bg-[var(--glass-inset-bg)] px-1.5 py-0.5 font-mono text-xs">.env.local</code> and restart the
            server. Translate and its voice features work without it.
          </p>
        </div>
      )}
    </div>
  );
}
