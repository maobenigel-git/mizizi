// Applies supabase/migrations/*.sql in order, each exactly once, then
// supabase/seed.sql (which is idempotent). Safe to run repeatedly.
//
//   npm run db:migrate            reads DATABASE_URL from .env.local
//
// Applied migrations are recorded in `schema_migrations`. For a database set
// up by hand before this script existed, mark what's already there instead of
// re-running it:  npm run db:migrate -- --baseline 0001_init.sql 0002_accounts.sql
import { readdirSync, readFileSync } from "node:fs";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Add it to .env.local (see .env.example), then run this again.");
  process.exit(1);
}

const dir = new URL("../supabase/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const sql = postgres(url, { prepare: false, max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const applied = new Set((await sql`select name from schema_migrations`).map((r) => r.name));

  const baselineAt = process.argv.indexOf("--baseline");
  if (baselineAt !== -1) {
    for (const name of process.argv.slice(baselineAt + 1)) {
      await sql`insert into schema_migrations (name) values (${name}) on conflict do nothing`;
      console.log(`marked as applied: ${name}`);
    }
    process.exit(0);
  }

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`✓ ${file} (already applied)`);
      continue;
    }
    // One transaction per file: a failed migration leaves nothing half-done.
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(new URL(file, dir), "utf8"));
      await tx`insert into schema_migrations (name) values (${file})`;
    });
    console.log(`✓ ${file} applied`);
  }

  await sql.unsafe(readFileSync(new URL("../supabase/seed.sql", import.meta.url), "utf8"));
  console.log("✓ seed.sql loaded");
} catch (error) {
  console.error(`\nMigration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
