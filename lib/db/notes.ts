import "server-only";
import postgres from "postgres";
import { NOTE_MAX_LENGTH } from "@/lib/session/types";

/*
 * Lesson notes.
 *
 * Deliberately NOT in the session cookie, unlike the rest of the learner's
 * state. Measured: one 240-character note costs 452 bytes there, and 1,652 if
 * it contains accented characters — which notes about Gĩkũyũ or maĩ obviously
 * do, because URL-encoding triples every non-ASCII byte. A handful of those
 * blows the ~4KB cookie limit, and a browser drops an oversized cookie
 * silently, taking the streak and the notebook with it.
 *
 * Storage follows lib/db/contributions.ts: Postgres when DATABASE_URL is set,
 * otherwise an in-memory list for local development, keyed by the session's
 * anonymous userId.
 */

export type Note = {
  id: string;
  userId: string;
  text: string;
  languageId: string;
  /** What the learner was looking at — a phrase, or a lesson step title. */
  context?: string;
  createdAt: string;
};

/** Generous, because these no longer compete with the cookie budget. */
export { NOTE_MAX_LENGTH };
export const NOTES_LIMIT = 200;

const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { prepare: false }) : undefined;
const memory: Note[] = [];

export const notesPersisted = Boolean(sql);

export async function listNotes(userId: string, languageId?: string): Promise<Note[]> {
  if (!sql) {
    return memory
      .filter((n) => n.userId === userId && (!languageId || n.languageId === languageId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const rows = languageId
    ? await sql`select id, user_id, text, language_id, context, created_at from learner_notes
                where user_id = ${userId} and language_id = ${languageId}
                order by created_at desc limit ${NOTES_LIMIT}`
    : await sql`select id, user_id, text, language_id, context, created_at from learner_notes
                where user_id = ${userId} order by created_at desc limit ${NOTES_LIMIT}`;
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    text: r.text,
    languageId: r.language_id,
    context: r.context ?? undefined,
    createdAt: new Date(r.created_at).toISOString(),
  }));
}

export async function countNotes(userId: string): Promise<number> {
  if (!sql) return memory.filter((n) => n.userId === userId).length;
  const [row] = await sql`select count(*)::int as n from learner_notes where user_id = ${userId}`;
  return row.n;
}

export async function addNote(note: Note): Promise<void> {
  if (!sql) {
    memory.push(note);
    // Oldest-first trim, so a runaway client can't grow the process unbounded.
    const mine = memory.filter((n) => n.userId === note.userId);
    if (mine.length > NOTES_LIMIT) {
      const cutoff = mine.sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
      memory.splice(memory.indexOf(cutoff), 1);
    }
    return;
  }
  await sql`
    insert into learner_notes (id, user_id, text, language_id, context)
    values (${note.id}, ${note.userId}, ${note.text}, ${note.languageId}, ${note.context ?? null})`;
}

/** Scoped by userId so one learner can never delete another's note. */
export async function removeNote(userId: string, id: string): Promise<void> {
  if (!sql) {
    const i = memory.findIndex((n) => n.id === id && n.userId === userId);
    if (i >= 0) memory.splice(i, 1);
    return;
  }
  await sql`delete from learner_notes where id = ${id} and user_id = ${userId}`;
}
