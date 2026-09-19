-- Mizizi — initial schema
-- Postgres + pgvector. Runs on Supabase or any Postgres 15+ with the vector extension.
--
-- Principles (see docs/spec.md):
--   * No hard-coded language count: languages/varieties can be added, merged, split.
--   * Every linguistic/cultural record carries provenance (source, license, verified).
--   * Translations are a shared-concept graph with an explicit confidence tier.
--   * Literature licensing is tracked separately from language-corpus licensing.
--
-- Embedding columns use vector(1024); change the dimension to match the
-- embedding model once one is chosen.

create extension if not exists vector;
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────

create type coverage_tier as enum ('full', 'developing', 'heritage');
create type language_status as enum ('active', 'endangered', 'revitalization');
create type confidence_tier as enum (
  'verified',
  'community_verified',
  'corpus_supported',
  'machine_generated',
  'ai_suggested',
  'not_available'
);
create type library_category as enum (
  'public_domain',   -- A: full text may be hosted
  'open_licence',    -- B: full text per licence terms
  'licensed',        -- C: permission obtained
  'copyrighted'      -- D: metadata + permitted excerpts + external link only
);
create type proficiency_level as enum ('beginner', 'intermediate', 'advanced');
create type notebook_item_type as enum ('word', 'phrase', 'sentence');
create type contribution_type as enum ('translate', 'verify', 'record', 'proverb');
create type contribution_status as enum ('open', 'in_review', 'closed');

-- ─────────────────────────────────────────────────────────────
-- Provenance
-- ─────────────────────────────────────────────────────────────

create table licenses (
  id          text primary key,            -- e.g. 'CC0-1.0', 'CC-BY-4.0', 'all-rights-reserved'
  name        text not null,
  url         text,
  allows_redistribution boolean not null default false,
  allows_derivatives    boolean not null default false,
  notes       text
);

create table sources (
  id          uuid primary key default gen_random_uuid(),
  source_type text not null,               -- 'kencorpus' | 'common_voice' | 'afrivoices_ke' | 'huggingface' | 'community' | 'publication' | ...
  title       text not null,
  author      text,
  publisher   text,
  published_on date,
  url         text,
  license_id  text references licenses(id),
  -- terms we must honour even under an open licence, e.g. Common Voice: do not identify speakers
  usage_restrictions text,
  created_at  timestamptz not null default now()
);

-- Generic citation link: any row in any table can cite any source.
create table citations (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references sources(id) on delete cascade,
  entity_type text not null,               -- table name, e.g. 'vocabulary', 'traditions'
  entity_id   uuid not null,
  locator     text,                        -- page, timestamp, file path within the corpus
  created_at  timestamptz not null default now()
);
create index citations_entity_idx on citations (entity_type, entity_id);

-- ─────────────────────────────────────────────────────────────
-- Language registry
-- ─────────────────────────────────────────────────────────────

create table language_families (
  id          text primary key,            -- 'bantu' | 'nilotic' | 'cushitic'
  name        text not null,
  description text
);

create table regions (
  id          text primary key,            -- slug, e.g. 'bungoma'
  name        text not null,
  kind        text not null default 'county', -- 'county' | 'region' | 'area'
  parent_id   text references regions(id)
);

create table languages (
  id            text primary key,          -- URL slug, e.g. 'dholuo'
  name          text not null,
  native_name   text,
  iso639_3      text,
  family_id     text not null references language_families(id),
  status        language_status not null default 'active',
  coverage      coverage_tier not null default 'heritage',
  is_focus      boolean not null default false,  -- one of the deep-supported launch languages
  -- a language entry may itself be a cluster (e.g. Luhya, Kalenjin)
  is_cluster    boolean not null default false,
  parent_id     text references languages(id),   -- set when this entry is a member of a cluster
  speakers      integer,
  description   text,
  verified      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table language_varieties (
  id          text primary key,
  language_id text not null references languages(id) on delete cascade,
  name        text not null,
  native_name text,
  iso639_3    text,
  description text
);

create table language_regions (
  language_id text not null references languages(id) on delete cascade,
  region_id   text not null references regions(id) on delete cascade,
  primary key (language_id, region_id)
);

-- ─────────────────────────────────────────────────────────────
-- Communities & culture knowledge graph
-- ─────────────────────────────────────────────────────────────

create table communities (
  id          text primary key,
  name        text not null,
  language_id text references languages(id),
  description text,
  verified    boolean not null default false
);

-- One table for all cultural facets keeps the graph queryable; `topic` selects the facet.
-- Facets: history | food | clothing | music | dance | festivals | oral_traditions |
--         proverbs | crafts | names | geography | traditions
create table cultural_topics (
  id           uuid primary key default gen_random_uuid(),
  community_id text not null references communities(id),
  topic        text not null,
  title        text not null,
  body         text not null,
  author       text,
  community_validated boolean not null default false,
  verified     boolean not null default false,
  source_id    uuid references sources(id),
  embedding    vector(1024),
  created_at   timestamptz not null default now()
);
create index cultural_topics_community_idx on cultural_topics (community_id, topic);

create table proverbs (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  community_id text references communities(id),
  text         text not null,
  literal_translation text,
  meaning      text,
  source_id    uuid references sources(id),
  community_validated boolean not null default false,
  verified     boolean not null default false
);

create table people (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  born        integer,
  died        integer,                     -- year; drives copyright-term checks for authors
  bio         text,
  source_id   uuid references sources(id)
);

create table places (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  region_id   text references regions(id),
  description text
);

-- ─────────────────────────────────────────────────────────────
-- Linguistic content
-- ─────────────────────────────────────────────────────────────

-- Language-independent meaning node: the hub of the translation graph.
create table concepts (
  id          text primary key,            -- e.g. 'GREETING_HELLO'
  gloss_en    text not null,
  domain      text                         -- 'greetings', 'kinship', 'agriculture', ...
);

create table vocabulary (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  variety_id   text references language_varieties(id),
  concept_id   text references concepts(id),
  term         text not null,
  meaning_en   text,
  part_of_speech text,
  phonetic     text,
  source_id    uuid references sources(id),
  license_id   text references licenses(id),
  verified     boolean not null default false,
  embedding    vector(1024),
  created_at   timestamptz not null default now()
);
create index vocabulary_language_idx on vocabulary (language_id);
create index vocabulary_term_trgm_idx on vocabulary using gin (term gin_trgm_ops);

create table phrases (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  concept_id   text references concepts(id),
  text         text not null,
  meaning_en   text,
  source_id    uuid references sources(id),
  license_id   text references licenses(id),
  verified     boolean not null default false
);

create table sentences (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  text         text not null,
  translation_en text,
  genre        text,                       -- Kencorpus genres: culture | news | creative_writing | agriculture
  source_id    uuid references sources(id),
  license_id   text references licenses(id),
  verified     boolean not null default false,
  embedding    vector(1024)
);

create table grammar_rules (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  title        text not null,
  explanation  text not null,
  examples     jsonb not null default '[]',
  source_id    uuid references sources(id),
  verified     boolean not null default false
);

-- Translation graph: each language's realisation of a concept, with confidence.
create table translations (
  id           uuid primary key default gen_random_uuid(),
  concept_id   text not null references concepts(id),
  language_id  text not null references languages(id),
  text         text not null,
  confidence   confidence_tier not null,
  source_id    uuid references sources(id),
  notes        text,
  created_at   timestamptz not null default now(),
  unique (concept_id, language_id, text)
);

-- ─────────────────────────────────────────────────────────────
-- Audio & pronunciation
-- ─────────────────────────────────────────────────────────────

-- Speakers are pseudonymous by design (Common Voice terms forbid identifying speakers).
create table speakers (
  id           uuid primary key default gen_random_uuid(),
  external_ref text,                       -- opaque id from the source corpus
  language_id  text references languages(id),
  variety_id   text references language_varieties(id)
);

create table audio_recordings (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  speaker_id   uuid references speakers(id),
  url          text not null,
  duration_ms  integer,
  transcript   text,
  validated    boolean not null default false,
  source_id    uuid references sources(id),
  license_id   text references licenses(id)
);

create table pronunciations (
  id           uuid primary key default gen_random_uuid(),
  vocabulary_id uuid references vocabulary(id) on delete cascade,
  phrase_id    uuid references phrases(id) on delete cascade,
  phonetic     text,
  audio_id     uuid references audio_recordings(id),
  slow_audio_id uuid references audio_recordings(id), -- 0.7x version
  check (vocabulary_id is not null or phrase_id is not null)
);

-- ─────────────────────────────────────────────────────────────
-- Lessons & quizzes
-- ─────────────────────────────────────────────────────────────

create table lessons (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  slug         text not null,
  title        text not null,
  level        proficiency_level not null,
  position     integer not null,
  unique (language_id, slug)
);

-- Ordered steps following the learning loop:
-- learn → pronounce → context → culture → challenge → conversation
create table lesson_items (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid not null references lessons(id) on delete cascade,
  position     integer not null,
  step         text not null,
  vocabulary_id uuid references vocabulary(id),
  phrase_id    uuid references phrases(id),
  sentence_id  uuid references sentences(id),
  cultural_topic_id uuid references cultural_topics(id),
  payload      jsonb not null default '{}'
);

create table quizzes (
  id           uuid primary key default gen_random_uuid(),
  lesson_id    uuid references lessons(id) on delete cascade,
  title        text not null
);

create table questions (
  id           uuid primary key default gen_random_uuid(),
  quiz_id      uuid not null references quizzes(id) on delete cascade,
  kind         text not null,              -- 'multiple_choice' | 'translate' | 'listen' | 'match'
  prompt       jsonb not null,
  answer       jsonb not null,
  position     integer not null
);

-- ─────────────────────────────────────────────────────────────
-- Literature (licensing independent of corpus licensing)
-- ─────────────────────────────────────────────────────────────

create table authors (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid references people(id),
  name         text not null
);

create table books (
  id           text primary key,           -- slug
  title        text not null,
  author_id    uuid references authors(id),
  published_year integer,
  category     library_category not null default 'copyrighted',
  rights_notes text,                       -- who confirmed the rights position, and when
  summary      text,
  external_url text,                       -- publisher / library / purchase link
  full_text_url text,                      -- only permitted for public_domain / open_licence / licensed
  created_at   timestamptz not null default now(),
  check (full_text_url is null or category <> 'copyrighted')
);

create table book_languages (
  book_id      text not null references books(id) on delete cascade,
  language_id  text not null references languages(id),
  primary key (book_id, language_id)
);

create table book_topics (
  book_id      text not null references books(id) on delete cascade,
  cultural_topic_id uuid not null references cultural_topics(id) on delete cascade,
  primary key (book_id, cultural_topic_id)
);

create table book_excerpts (
  id           uuid primary key default gen_random_uuid(),
  book_id      text not null references books(id) on delete cascade,
  text         text not null,
  locator      text,
  justification text not null            -- why this excerpt is legally permitted
);

-- ─────────────────────────────────────────────────────────────
-- Users, onboarding & progress
-- ─────────────────────────────────────────────────────────────
-- user ids reference Supabase auth.users when deployed on Supabase.

create table onboarding_profiles (
  user_id      uuid primary key,
  display_name text not null,
  avatar       text,
  county       text references regions(id),
  chosen_language_id text references languages(id),
  self_reported_level proficiency_level,
  completed_at timestamptz
);

create table user_progress (
  user_id      uuid not null,
  lesson_id    uuid not null references lessons(id) on delete cascade,
  completed_at timestamptz,
  score        numeric,
  primary key (user_id, lesson_id)
);

create table user_streaks (
  user_id            uuid primary key,
  current_streak     integer not null default 0,
  longest_streak     integer not null default 0,
  freezes_banked     integer not null default 0 check (freezes_banked between 0 and 3),
  last_activity_date date,               -- in the user's local timezone
  timezone           text not null default 'Africa/Nairobi'
);

create table user_xp (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  amount       integer not null,
  reason       text not null,
  earned_at    timestamptz not null default now()
);
create index user_xp_user_idx on user_xp (user_id, earned_at);

create table user_answers (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  question_id  uuid not null references questions(id) on delete cascade,
  answer       jsonb not null,
  correct      boolean not null,
  answered_at  timestamptz not null default now()
);

create table word_of_day (
  id           uuid primary key default gen_random_uuid(),
  language_id  text not null references languages(id),
  vocabulary_id uuid not null references vocabulary(id),
  shown_date   date not null,
  unique (language_id, shown_date)
);

create table notebook_entries (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  item_type    notebook_item_type not null,
  item_id      uuid not null,
  source       text not null,              -- 'lesson' | 'word_of_day' | 'culture_article' | ...
  saved_at     timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- ─────────────────────────────────────────────────────────────
-- Community (v1: directory + structured contributions, no messaging)
-- ─────────────────────────────────────────────────────────────

create table community_profiles (
  user_id      uuid primary key,
  speaks_languages   text[] not null default '{}',
  learning_languages text[] not null default '{}',
  county       text references regions(id),
  interests    text[] not null default '{}',
  contributor_verified boolean not null default false,
  directory_opt_in boolean not null default false  -- explicit consent to be listed
);

create table contribution_tasks (
  id           uuid primary key default gen_random_uuid(),
  type         contribution_type not null,
  language_id  text not null references languages(id),
  prompt       text not null,
  concept_id   text references concepts(id),
  status       contribution_status not null default 'open',
  created_at   timestamptz not null default now()
);

create table contribution_submissions (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references contribution_tasks(id) on delete cascade,
  user_id      uuid not null,
  content      jsonb not null,
  confidence_tier confidence_tier not null default 'ai_suggested',
  reviewed_by  uuid,
  created_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- AI
-- ─────────────────────────────────────────────────────────────

create table ai_conversations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null,
  language_id  text references languages(id),
  mode         text not null,              -- 'tutor' | 'translator' | 'cultural'
  messages     jsonb not null default '[]',
  created_at   timestamptz not null default now()
);

create table ai_feedback (
  id           uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references ai_conversations(id) on delete cascade,
  user_id      uuid not null,
  rating       smallint,
  comment      text,
  created_at   timestamptz not null default now()
);
