import "server-only";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/*
 * Accounts, and the copy of each account's progress that lets a learner sign
 * in on a new device and find their streak waiting.
 *
 * The account id *is* the session's userId, so notes, contributions and the
 * directory listing — all keyed by userId already — follow the account without
 * any migration.
 *
 * Progress is stored as one JSON snapshot of the session (`learner_state`)
 * rather than spread over user_progress / user_streaks / user_xp. Those tables
 * are the long-term shape; until the rest of the app reads from them, one
 * snapshot keeps lib/session the only place that knows how progress is laid
 * out.
 *
 * Storage follows lib/db/notes.ts: Postgres when DATABASE_URL is set,
 * otherwise in memory for local development — where accounts vanish on
 * restart, which is why DATABASE_URL is required in production.
 */

const scrypt = promisify(scryptCallback) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const KEY_LENGTH = 64;

import { memoryStore, sql } from "./client";

type AccountRow = { id: string; contact: string; passwordHash: string };
const memoryAccounts = memoryStore("accounts", () => new Map<string, AccountRow>()); // by contact
const memoryState = memoryStore("learner_state", () => new Map<string, unknown>()); // by account id

/** A missing DATABASE_URL in production is reported once at start-up (instrumentation.ts). */
export const accountsPersisted = Boolean(sql);

/** `scrypt$<salt>$<hash>`, both base64url. The prefix leaves room to change algorithm later. */
async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return timingSafeEqual(actual, expected);
}

async function findAccount(contact: string): Promise<AccountRow | undefined> {
  if (!sql) return memoryAccounts.get(contact);
  const [row] = await sql`select id, contact, password_hash from accounts where contact = ${contact}`;
  return row ? { id: row.id, contact: row.contact, passwordHash: row.password_hash } : undefined;
}

/** `contact` must already be normalised (lib/session/contact). */
export async function createAccount(
  id: string,
  contact: string,
  password: string,
): Promise<{ ok: true } | { ok: false; reason: "taken" }> {
  const passwordHash = await hashPassword(password);
  if (!sql) {
    if (memoryAccounts.has(contact)) return { ok: false, reason: "taken" };
    memoryAccounts.set(contact, { id, contact, passwordHash });
    return { ok: true };
  }
  const rows = await sql`
    insert into accounts (id, contact, password_hash) values (${id}, ${contact}, ${passwordHash})
    on conflict (contact) do nothing
    returning id`;
  return rows.length ? { ok: true } : { ok: false, reason: "taken" };
}

/**
 * The account id when the password matches. An unknown contact still pays for
 * one hash, so response time does not reveal which contacts are registered.
 */
export async function verifyAccount(contact: string, password: string): Promise<string | undefined> {
  const account = await findAccount(contact);
  if (!account) {
    await hashPassword(password);
    return undefined;
  }
  return (await checkPassword(password, account.passwordHash)) ? account.id : undefined;
}

export async function loadState(accountId: string): Promise<unknown> {
  if (!sql) return memoryState.get(accountId);
  const [row] = await sql`select state from learner_state where user_id = ${accountId}`;
  return row?.state;
}

export async function saveState(accountId: string, state: unknown): Promise<void> {
  if (!sql) {
    memoryState.set(accountId, state);
    return;
  }
  await sql`
    insert into learner_state (user_id, state, updated_at) values (${accountId}, ${sql.json(state as never)}, now())
    on conflict (user_id) do update set state = excluded.state, updated_at = now()`;
}
