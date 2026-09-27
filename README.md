# Mizizi

A platform for learning and exploring Kenya's languages, cultures and literary heritage.

> *Mizizi* is Kiswahili for "roots".

We are building the infrastructure to make Kenya's languages, cultures and literary heritage
digitally accessible, beginning with the languages for which high-quality data already exists.

The full architecture and product spec lives in [`docs/spec.md`](docs/spec.md).

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind CSS v4
- PostgreSQL + pgvector (Supabase), schema in [`supabase/migrations`](supabase/migrations)
- Claude (`@anthropic-ai/sdk`) behind a server-side orchestrator for the tutor

## Getting started

```bash
npm install
cp .env.example .env.local   # everything in it is optional locally
npm run dev
```

Open http://localhost:3000. New visitors are routed through onboarding (create an account, profile,
language, level); nothing else is reachable until it is finished. Returning learners use
"I have an account" to sign in and pick up their streak.

Locally, with no `DATABASE_URL`, accounts and notes are held in memory and disappear when the dev
server restarts.

**Adding API keys:** `npm run dev` prints a one-time link to a local setup screen (`/setup`) where you
paste each key, check it works, and save it to the git-ignored `.env.local`. Step-by-step instructions
for every service are in [`docs/api-setup.md`](docs/api-setup.md).

To open the dev server from a phone on the same Wi-Fi, use the "Network:" address it prints. This
machine's own network addresses are allowed automatically (`next.config.ts`); add any other host,
such as a tunnel, to `DEV_ALLOWED_ORIGINS`. Browsers only allow the microphone on `localhost` or
HTTPS, so test pronunciation on a phone with `npx next dev --experimental-https`.

## What's in the app

| Area | Route | Notes |
|---|---|---|
| Onboarding gate | `/onboarding/*` | Enforced in `proxy.ts`; welcome, account, profile, language, level |
| Sign in | `/onboarding/signin` | Restores an account's streak, XP, path and notebook on any device |
| Today | `/today` | Streak, daily goal, weekly strip, next lesson, Word of the Day |
| Learn | `/learn` | Animated level path; `/learn/[n]` runs a level (see [Lessons and levels](#lessons-and-levels)) |
| Notebook | `/notebook` | Saved words and free-text lesson notes, source tags, "Quiz me on these" |
| Tutor | `/practice` | AI tutor grounded in verified data only; ask by voice, replies read aloud |
| Translate | `/translate` | Concept-graph lookup, Google fallback, confidence tiers, dictation and playback |
| Explore | `/explore` | Search across languages, cultures, books and words |
| Languages | `/languages/[language]` | One generic page for every language |
| Culture | `/culture/[language]` | Knowledge-graph facets; sourced articles only |
| Literature | `/literature/[book]` | Rights-aware catalogue, no hosted text |
| Community | `/community` | Opt-in directory + micro-contribution tasks, no messaging |

API routes live under `app/api` and mirror docs/spec.md §1.15.

## Deploying

Any Node host works (Vercel, Render, Fly, a VPS with `npm run build && npm start`).

1. **Database.** Create a Postgres 15+ database with the `vector` and `pg_trgm` extensions
   (Supabase has both), put its connection string in `DATABASE_URL`, and run
   `npm run db:migrate`. That applies every file in [`supabase/migrations`](supabase/migrations)
   once, in order (`0001` schema, `0002` accounts, `0003` levels and progress), then
   [`supabase/seed.sql`](supabase/seed.sql). Safe to re-run; it skips what's applied. Regenerate
   the seed with `npm run db:seed:generate` after editing the registry.
2. **Environment.** Set these in the host's dashboard. [`.env.example`](.env.example) documents each.

   | Variable | Required | Without it |
   |---|---|---|
   | `SESSION_SECRET` | **yes** | Signed-in pages return an error naming the variable |
   | `DATABASE_URL` | **yes** | Accounts, progress sync, notes and contributions live in memory and are lost on restart (a warning is logged) |
   | `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` | no | The tutor answers from checked data only |
   | `GOOGLE_SERVICE_ACCOUNT_KEY` (+ `GOOGLE_CLOUD_PROJECT`, `GOOGLE_SPEECH_REGION`) | no | Kiswahili speaking uses the browser's recogniser; Dholuo and Kamba speaking is unscored |
   | `MMS_SERVER_URL` + `MMS_SERVER_TOKEN` | no | No MMS speech: Gikuyu speaking is unscored and has no voice ([`mms-server/`](mms-server/README.md)) |
   | `NLLB_ENDPOINT_URL` + `HUGGINGFACE_API_TOKEN` | no | No sentence translation into Gikuyu or Kamba |

   Generate the secret with `openssl rand -base64 48`.
3. **Gates.** `npm run typecheck`, `npm run lint` and `npm run build` must all pass.

Translation (Wiktionary, Google) and voice (Google TTS, the browser's speech recogniser) need no
keys.

### How learner state is stored

- **On the device:** an httpOnly cookie signed with `SESSION_SECRET` (`lib/session`). Tampering with
  it (a hand-edited streak, someone else's user id) makes it read as empty.
- **On the account:** every save is also written to `learner_state` (`lib/db/accounts`), which is
  what signing in on another device restores. Passwords are hashed with scrypt; accounts are keyed
  by a normalised phone number (`+254…`) or email. Sign-in attempts are rate-limited per contact.
- **Notes** are in `learner_notes`, never the cookie (see below).

"Sign out" clears the device and keeps the account's progress. "Reset all progress" wipes it on
both.

### Known limits

- Two devices signed in to the same account at once: the last one to save wins.
- Rate limits (tutor, sign-in) are per server instance; move them to a shared store (Redis/Upstash)
  when running more than one.
- No password reset yet. It needs an SMS or email provider; phone-first (Africa's Talking or
  similar) fits the audience.
- Content: vocabulary is a small unverified seed for Kiswahili and Gikuyu. Real lessons, audio and
  translations come from the Kencorpus / Common Voice import pipeline.

## Lessons and levels

Each language has a path of levels — Level 1, 2, 3 … — drawn as a winding trail on `/learn`.

**Rules** (all enforced on the server, `lib/lessons/progress.ts`):

- Level 1 is open; level N opens when level N−1 is completed. `/learn/[n]` redirects a locked level
  back to the path, so the lock is real, not just drawn.
- Answers are graded by server actions (`lib/lessons/actions.ts`) against an answer key
  snapshotted when the attempt starts. The browser never receives the answers.
- A level is complete only when `completeLevel` finds every required exercise satisfied and the
  first-try score at or above the level's `passScore`. A missed question returns at the end of the
  level until it is answered right; the score keeps the first try.
- Progress lives in `user_lesson_progress`, keyed by user id, so it follows an account to any
  device. Levels finished before the level system existed are imported from the old cookie list the
  first time the path is read.

**Content.** Levels come from two places, merged by level number (`lib/lessons/levels.ts`):

- *Generated* — the orientation course built from the language registry and seeded vocabulary.
  Every language has these. Vocabulary levels run the full loop: words → listening (where a voice
  exists) → speaking → final check.
- *Authored* — rows in `courses` → `lessons` → `lesson_exercises`. An authored level N replaces
  generated level N; authored levels past the end extend the path. The path stops at the first gap.

To add Level 101, insert a published `lessons` row with `course_id`, `level_number = 101`,
`title`, `summary` and optionally `requirements` (`{ "passScore": 70 }`), then its exercises.
Exercise `content` by `kind`:

| kind | content |
|---|---|
| `info` | `{ "title", "body" }` |
| `choice`, `final_check` | `{ "prompt", "options": [...], "answer": <index>, "explain"? }` |
| `listening` | `{ "text", "options": [...], "answer": <index>, "audioUrl"? }` |
| `pronunciation` | `{ "text", "meaning", "audioUrl"?, "verified"? }` |

Rows whose content doesn't match their kind are skipped rather than rendered broken.

**Scale.** The path page renders ~40 levels around the learner's current one and loads more from
`GET /api/courses/[languageId]/path?from=&limit=` as they scroll; its SVG covers only the loaded
window. Checked with a 1,000-level course: 41 nodes in the DOM, opening centred on the current level.

### Pronunciation

A pronunciation exercise shows the phrase, records the learner, and marks each word **clear**,
**unclear** or **missed**, with an overall Excellent / Almost there / Needs practice. After any
attempt that isn't excellent, the correct pronunciation plays: a native recording if the word has
one, otherwise the labelled machine voice (Kiswahili only), otherwise nothing — never another
language's voice. "Hear yourself" replays the learner's own attempt.

Which recogniser hears the learner (`lib/speech/recognition.ts`):

| Language | Recogniser | Scored by |
|---|---|---|
| Kiswahili, Dholuo, Kamba | Google Cloud Speech-to-Text V2, `chirp_2`, with word confidence | server, per word |
| whatever the MMS server reports (Gikuyu, Dholuo, Kamba, Kiswahili, Somali, Samburu, Teso) | self-hosted Meta MMS (`mms-server/`, via `lib/speech/mms-client.ts`) | server, per word |
| Kiswahili (no Google key) | the browser's Web Speech API (Chrome, Edge) | server, from the transcript |
| everything else | none exists | not scored — read-aloud practice |

What this does **not** do: score individual sounds. No available API assesses pronunciation at the
sound level for any Kenyan language (Azure's pronunciation assessment has 33 locales, none of them
Kenyan), so the app says which *words* came through, not which sounds, and says so on screen.

The audio is recorded in the browser as 16 kHz mono WAV, posted to `POST /api/pronunciation/assess`
with the attempt and exercise ids, sent to Google from the server, and discarded. The target text
comes from the attempt's answer key, never the request. Only scores are stored
(`pronunciation_attempts`). Rate-limited to 60 recordings per learner per hour.

Nobody gets stuck on a speaking exercise: it is satisfied by a score of 60+, by three tries
(a Google outage counts as a try, never as a score), or by **Can't speak right now**, which is
recorded as skipped and left out of the score. Adding a recogniser — a self-hosted Meta MMS model for
Gikuyu, say — is one more entry in `serverProviders` in `lib/speech/recognition.ts`.

## Translation and voice

Three layers, in the order the app tries them, each labelled in the UI so a learner always knows
what they are looking at:

| Layer | Source | Tier shown | Covers |
|---|---|---|---|
| Word graph | `data/` + `lib/db/vocabulary` | `verified`; unchecked seed words by provenance: `corpus_supported` if cited, else `ai_suggested` | whatever has been seeded |
| Curated dictionary | English Wiktionary (`lib/translation/wiktionary.ts`) | `corpus_supported` | **22 languages**, single English words |
| Machine translation | Google Translate, keyless (`lib/translation/google.ts`) | `machine_generated` | 4 languages, whole sentences |
| Machine translation | NLLB-200 via `NLLB_ENDPOINT_URL` (`lib/translation/nllb.ts`) | `machine_generated` | adds Gikuyu and Kamba sentences; CC BY-NC |
| — | nothing invented | `not_available` | everything else |

The graph always wins. Wiktionary is asked next — it is human-edited and cited (CC BY-SA 4.0),
and it reaches Gikuyu, Kamba, Maasai, Meru, Luhya, Turkana and more that no machine translator
covers. Google is last, and is the only source that handles sentences.

Google's endpoint accepts some codes it does not actually translate (Gikuyu, for one) and echoes
the input back — that is detected and discarded rather than shown as a translation.

Voice is likewise split, and neither half needs an API key:

- **Speaking to the app** — the browser's Web Speech API (`components/voice/VoiceInput`). Chrome
  and Edge have it; where it is missing the button is not rendered at all.
- **The app speaking** — `/api/speech` proxies Google Translate's TTS, which has a Kiswahili and
  an English voice. For anything else the client falls back to the device's own synthesiser, and
  says so when there is no voice at all.

`SpeakButton` is a **machine** voice and is labelled that way everywhere. It is deliberately
separate from `PronunciationButton`, which plays licensed native-speaker recordings only and
still refuses to synthesise (docs/spec.md §2.4).

## Layout

```text
app/(app)/            screens behind the onboarding gate, sharing the app shell
app/onboarding/       the gated first-run flow
app/api/              route handlers
components/           UI, grouped by domain
data/                 seed registry, vocabulary, books, counties
lib/db/               data access (registry, vocabulary, library, culture, community, contributions, accounts, notes)
lib/session/          learner session (signed cookie), streak rules, accounts, server actions
lib/lessons/          levels catalogue, progress rules, grading actions, pronunciation scoring
lib/speech/           voices, recognisers (Google Speech-to-Text), service-account auth
lib/ai/               tutor orchestrator
lib/rate-limit.ts     per-instance limiters (tutor, sign-in)
lib/translation/      concept-graph translation
lib/search/           knowledge-graph search
proxy.ts              onboarding gate
supabase/             migrations and generated seed
```

## Lesson notes

Learners can write notes during any lesson; they collect in the Notebook.

Notes live in `lib/db/notes.ts` (Postgres when `DATABASE_URL` is set, in-memory otherwise) and
**not** in the session cookie, unlike the rest of the learner's state. That is a measured
decision: one 240-character note costs 452 bytes in the cookie and **1,652 bytes if it contains
accented characters**, because URL-encoding triples every non-ASCII byte — and notes about
Gĩkũyũ or maĩ obviously do. A browser drops an oversized cookie silently, taking the streak and
the notebook with it.

`trimToFit` in `lib/session` guards the same limit for what does stay in the cookie. It is not
theoretical: `NOTEBOOK_LIMIT` is 40 and one entry costs ~135 bytes encoded, so a full notebook is
~5.9KB on its own and would have silently wiped the session before the guard existed.
