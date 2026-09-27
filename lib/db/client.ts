import "server-only";
import postgres from "postgres";

/*
 * The one Postgres pool the app shares. Every lib/db module used to open its
 * own, which multiplied idle connections against the pooler for no benefit.
 *
 * `prepare: false` because DATABASE_URL is expected to be a transaction-mode
 * pooler (Supabase's pooled string), which does not support prepared statements.
 *
 * Undefined without DATABASE_URL: each module then falls back to memory.
 */
export const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { prepare: false }) : undefined;

/*
 * The in-memory fallback stores, kept on globalThis.
 *
 * Next.js can load a server module more than once — route handlers and
 * pages/server actions are bundled separately — so a plain module-level Map
 * gave each its own copy: a level completed through a server action was
 * invisible to /api/courses/…/path. One store per name, shared process-wide,
 * fixes that (and survives dev hot reloads). Only used without DATABASE_URL.
 */
const stores = ((globalThis as { __miziziMemory?: Map<string, unknown> }).__miziziMemory ??= new Map());

export function memoryStore<T>(name: string, create: () => T): T {
  if (!stores.has(name)) stores.set(name, create());
  return stores.get(name) as T;
}
