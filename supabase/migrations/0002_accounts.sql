-- Mizizi — accounts and synced learner progress (lib/db/accounts.ts).
--
-- `accounts.id` is the learner's userId, the same id learner_notes,
-- community_profiles and contribution_submissions already key on, so those
-- follow the account without a data migration.
--
-- `learner_state` is one JSON snapshot of the session (streak, XP, completed
-- lessons, notebook…). The normalised user_progress / user_streaks / user_xp
-- tables in 0001 remain the long-term shape; lib/session is the only reader and
-- writer of this snapshot, so moving to them later stays inside that folder.

create table accounts (
  id             uuid primary key,
  -- Normalised: +254… for Kenyan numbers, lower-case for email.
  contact        text not null unique,
  -- scrypt$<salt>$<hash>, never the password.
  password_hash  text not null,
  created_at     timestamptz not null default now()
);

create table learner_state (
  user_id     uuid primary key references accounts(id) on delete cascade,
  state       jsonb not null,
  updated_at  timestamptz not null default now()
);

-- Server-side access only (the app connects with DATABASE_URL). With RLS on
-- and no policies, Supabase's public API cannot read password hashes.
alter table accounts enable row level security;
alter table learner_state enable row level security;
