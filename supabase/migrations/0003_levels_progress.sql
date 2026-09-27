-- Mizizi — lesson levels, server-graded attempts and pronunciation results.
--
-- Content model
--   courses            one per language
--   lessons            + level_number: Level 1, 2, 3 … within a course
--   lesson_exercises   the ordered exercises inside a level
--
-- Levels authored here are merged with the orientation levels the app
-- generates from the language registry (lib/lessons/levels.ts): an authored
-- level N replaces generated level N, and authored levels past the generated
-- ones extend the path. So adding Level 101 is an insert, not a code change.
--
-- Progress model
--   user_lesson_progress    one row per learner per level they have touched
--   lesson_attempts         one run through a level, with its answer key
--   exercise_results        every answer, graded on the server
--   pronunciation_attempts  every scored recording (the audio is never kept)
--
-- "Locked" is never stored: level N is open when N = 1 or level N-1 is
-- completed, so the two can never disagree.
--
-- user_id has no foreign key to accounts: learners who onboarded before
-- accounts existed have a userId but no account row.

create table courses (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null unique references languages(id),
  title        text not null,
  published    boolean not null default true
);

alter table lessons add column course_id uuid references courses(id) on delete cascade;
alter table lessons add column level_number integer check (level_number >= 1);
alter table lessons add column summary text not null default '';
-- { passScore, pronunciationPass, pronunciationAttemptsToSkip } — see
-- lib/lessons/levels.ts `Requirements`; omitted keys take the defaults there.
alter table lessons add column requirements jsonb not null default '{}';
alter table lessons add column published boolean not null default false;
create unique index lessons_course_level_idx on lessons (course_id, level_number) where course_id is not null;

create table lesson_exercises (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references lessons(id) on delete cascade,
  position     integer not null,
  kind         text not null check (kind in ('info', 'choice', 'listening', 'pronunciation', 'final_check')),
  -- Shape per kind is the `Exercise` union in lib/lessons/levels.ts, e.g.
  --   choice:        { "prompt": "...", "options": ["a","b","c"], "answer": 0, "explain": "..." }
  --   pronunciation: { "text": "Habari yako", "meaning": "How are you", "audioUrl": null }
  content      jsonb not null,
  required     boolean not null default true,
  unique (lesson_id, position)
);

-- The unused v0 progress table is superseded by user_lesson_progress.
drop table if exists user_progress;

create table user_lesson_progress (
  user_id                uuid not null,
  language_id            text not null references languages(id),
  level_number           integer not null check (level_number >= 1),
  -- The level's content id when it was last attempted (generated "gikuyu:meet",
  -- or an authored lessons.id). Progress is keyed by level number, so it
  -- survives a level's content being rewritten.
  lesson_id              text not null,
  completion_status      text not null check (completion_status in ('in_progress', 'completed')),
  progress_percentage    integer not null default 0 check (progress_percentage between 0 and 100),
  score                  integer check (score between 0 and 100),
  pronunciation_attempts integer not null default 0,
  completed_at           timestamptz,
  last_attempt_at        timestamptz not null default now(),
  primary key (user_id, language_id, level_number)
);
-- "Where is this learner up to" is a scan of one learner's completed levels.
create index user_lesson_progress_completed_idx
  on user_lesson_progress (user_id, language_id, level_number) where completion_status = 'completed';

create table lesson_attempts (
  id            uuid primary key,
  user_id       uuid not null,
  language_id   text not null references languages(id),
  level_number  integer not null,
  lesson_id     text not null,
  -- Snapshot of what is being graded, taken when the attempt starts, so a
  -- content edit mid-lesson cannot change the answers under the learner.
  answer_key    jsonb not null,
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  passed        boolean
);
create index lesson_attempts_user_idx on lesson_attempts (user_id, started_at desc);

create table exercise_results (
  id           uuid primary key default gen_random_uuid(),
  attempt_id   uuid not null references lesson_attempts(id) on delete cascade,
  exercise_id  text not null,
  correct      boolean not null,
  answered_at  timestamptz not null default now()
);
create index exercise_results_attempt_idx on exercise_results (attempt_id, answered_at);

create table pronunciation_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  attempt_id   uuid not null references lesson_attempts(id) on delete cascade,
  exercise_id  text not null,
  language_id  text not null references languages(id),
  target_text  text not null,
  transcript   text not null,
  score        integer not null check (score between 0 and 100),
  verdict      text not null check (verdict in ('excellent', 'almost', 'practice')),
  -- [{ expected, status: good|unclear|missed, heard?, confidence? }]
  words        jsonb not null,
  -- Which recogniser heard it: 'google' (Cloud Speech-to-Text) or 'browser'.
  provider     text not null,
  created_at   timestamptz not null default now()
);
create index pronunciation_attempts_attempt_idx on pronunciation_attempts (attempt_id, exercise_id);

-- Server-side access only, as in 0002.
alter table courses enable row level security;
alter table lesson_exercises enable row level security;
alter table user_lesson_progress enable row level security;
alter table lesson_attempts enable row level security;
alter table exercise_results enable row level security;
alter table pronunciation_attempts enable row level security;
