import type { Metadata } from "next";
import Link from "next/link";
import { contributionsPersisted, countSubmissions, listTasks, type TaskType } from "@/lib/db/contributions";
import { listLanguages } from "@/lib/db/languages";
import { getSession } from "@/lib/session";
import { submitTask } from "@/lib/session/actions";

export const metadata: Metadata = { title: "Contribute · Mizizi" };

const typeLabels: Record<TaskType, string> = {
  translate: "Translate",
  verify: "Verify",
  record: "Record",
  proverb: "Proverb",
};

export default async function ContributePage({ searchParams }: PageProps<"/community/contribute">) {
  const [{ language, thanks }, session, languages] = await Promise.all([searchParams, getSession(), listLanguages()]);
  const focus = languages.filter((l) => l.isFocus);
  const selected = focus.find((l) => l.id === language) ?? focus.find((l) => l.id === session.languageId) ?? focus[0];
  const tasks = listTasks(selected.id).filter((t) => t.key !== thanks);
  const submitted = session.userId ? await countSubmissions(session.userId) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <Link href="/community" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Community
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Help expand your language</h1>
        <p className="text-muted">
          Small, bounded tasks. Every answer goes to a review queue and is only shown to learners once a reviewer
          accepts it, labelled “Community verified”.
        </p>
        {submitted > 0 && <p className="text-sm font-medium text-accent">You have made {submitted} contribution{submitted === 1 ? "" : "s"}. Thank you.</p>}
      </header>

      {typeof thanks === "string" && (
        <p role="status" className="animate-fade-in rounded-xl border border-forest bg-forest/10 px-4 py-3 text-sm font-medium text-forest">
          Received — it is now in the review queue. +5 XP
        </p>
      )}

      <nav className="flex flex-wrap gap-2" aria-label="Language">
        {focus.map((l) => (
          <Link
            key={l.id}
            href={`/community/contribute?language=${l.id}`}
            className={`rounded-full border px-3 py-1 text-sm transition-colors duration-200 ease-out ${l.id === selected.id ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:border-accent"}`}
          >
            {l.name}
          </Link>
        ))}
      </nav>

      <ul className="space-y-3">
        {tasks.slice(0, 8).map((task) => (
          <li key={task.key} className="glass p-5">
            <form action={submitTask} className="space-y-3">
              <input type="hidden" name="taskKey" value={task.key} />
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">{typeLabels[task.type]}</span>
              <label className="block space-y-2">
                <span className="block font-medium">{task.prompt}</span>
                <textarea
                  name="content"
                  required
                  maxLength={500}
                  rows={2}
                  className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 outline-none transition-colors duration-200 ease-out focus:border-accent"
                />
              </label>
              <button type="submit" className="rounded-xl bg-accent-solid px-5 py-2 text-sm font-semibold text-white">
                Submit
              </button>
            </form>
          </li>
        ))}
      </ul>

      {!contributionsPersisted && (
        <p className="text-xs text-muted">Development mode: no database is connected, so submissions are not kept after a restart.</p>
      )}
    </div>
  );
}
