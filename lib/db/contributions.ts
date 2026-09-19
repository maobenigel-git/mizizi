import "server-only";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { languages } from "@/data/languages/registry";
import { seedWords } from "@/data/seed/word-of-day";

// Structured micro-contributions (docs/spec.md §2.5). Tasks are derived from
// gaps in the data; submissions land in a review queue at the lowest
// confidence tier and only move up when a reviewer accepts them.
//
// Storage: Postgres (`contribution_tasks` / `contribution_submissions`) when
// DATABASE_URL is set, otherwise an in-memory queue that is lost on restart —
// fine for local development, not for production.

export type TaskType = "translate" | "verify" | "record" | "proverb";

export type ContributionTask = {
  /** Stable key, e.g. `translate:dholuo:WATER`. */
  key: string;
  type: TaskType;
  languageId: string;
  prompt: string;
  conceptId?: string;
};

export type Submission = {
  taskKey: string;
  userId: string;
  content: string;
  createdAt: string;
};

const focus = languages.filter((l) => l.isFocus);
const concepts = [...new Map(seedWords.map((w) => [w.conceptId, w.meaning])).entries()];

export function listTasks(languageId?: string): ContributionTask[] {
  const tasks: ContributionTask[] = [];
  for (const language of focus) {
    for (const [conceptId, gloss] of concepts) {
      const existing = seedWords.find((w) => w.languageId === language.id && w.conceptId === conceptId);
      if (!existing) {
        tasks.push({
          key: `translate:${language.id}:${conceptId}`,
          type: "translate",
          languageId: language.id,
          conceptId,
          prompt: `How do you say “${gloss}” in ${language.name}?`,
        });
        continue;
      }
      if (!existing.verified) {
        tasks.push({
          key: `verify:${existing.id}`,
          type: "verify",
          languageId: language.id,
          conceptId,
          prompt: `Is “${existing.term}” the right ${language.name} word for “${gloss}”? Tell us yes, or what you would say instead.`,
        });
      }
      if (!existing.audioUrl) {
        tasks.push({
          key: `record:${existing.id}`,
          type: "record",
          languageId: language.id,
          conceptId,
          prompt: `Can you record yourself saying “${existing.term}”? Leave a note and we will contact you when recording opens.`,
        });
      }
    }
    tasks.push({
      key: `proverb:${language.id}`,
      type: "proverb",
      languageId: language.id,
      prompt: `Share a ${language.name} proverb from your community, with its meaning.`,
    });
  }
  return languageId ? tasks.filter((t) => t.languageId === languageId) : tasks;
}

const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { prepare: false }) : undefined;
const memory: Submission[] = [];

export const contributionsPersisted = Boolean(sql);

/** Deterministic UUID so a derived task maps onto one `contribution_tasks` row. */
function taskUuid(key: string): string {
  const h = createHash("sha1").update(key).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export async function submitContribution(task: ContributionTask, userId: string, content: string): Promise<void> {
  if (!sql) {
    memory.push({ taskKey: task.key, userId, content, createdAt: new Date().toISOString() });
    return;
  }
  const id = taskUuid(task.key);
  await sql`
    insert into contribution_tasks (id, type, language_id, prompt, status)
    values (${id}, ${task.type}, ${task.languageId}, ${task.prompt}, 'in_review')
    on conflict (id) do update set status = 'in_review'`;
  await sql`
    insert into contribution_submissions (task_id, user_id, content, confidence_tier)
    values (${id}, ${userId}, ${sql.json({ text: content, taskKey: task.key })}, 'ai_suggested')`;
}

export async function countSubmissions(userId: string): Promise<number> {
  if (!sql) return memory.filter((s) => s.userId === userId).length;
  const [row] = await sql`select count(*)::int as n from contribution_submissions where user_id = ${userId}`;
  return row.n;
}
