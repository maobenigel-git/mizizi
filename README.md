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
cp .env.example .env.local   # optional: tutor key, database
npm run dev
```

Open http://localhost:3000. New visitors are routed through onboarding; nothing else is reachable
until the sample lesson is finished.

## What's in the app

| Area | Route | Notes |
|---|---|---|
| Onboarding gate | `/onboarding/*` | Enforced in `proxy.ts`; five screens then a sample lesson |
| Today | `/today` | Streak, daily goal, weekly strip, next lesson, Word of the Day |
| Learn | `/learn` | Orientation course generated from the registry |
| Notebook | `/notebook` | Cross-language save-list, source tags, "Quiz me on these" |
| Tutor | `/practice` | AI tutor grounded in verified data only; ask by voice, replies read aloud |
| Translate | `/translate` | Concept-graph lookup, Google fallback, confidence tiers, dictation and playback |
| Explore | `/explore` | Search across languages, cultures, books and words |
| Languages | `/languages/[language]` | One generic page for every language |
| Culture | `/culture/[language]` | Knowledge-graph facets; sourced articles only |
| Literature | `/literature/[book]` | Rights-aware catalogue, no hosted text |
| Community | `/community` | Opt-in directory + micro-contribution tasks, no messaging |

API routes live under `app/api` and mirror docs/spec.md §1.15.

## Deploying

1. Create a Supabase project. Run `supabase/migrations/0001_init.sql`, then `supabase/seed.sql`
   (regenerate with `npm run db:seed:generate` after editing the registry).
2. Deploy to Vercel (or any Node host) and set the variables in [`.env.example`](.env.example).
3. `npm run build` must pass; `npm run lint` and `npm run typecheck` are the other gates.

Without `DATABASE_URL` the app still runs, but directory listings and contributions are held in
memory. Without `ANTHROPIC_API_KEY` the Tutor tab shows a "not connected" state; everything else,
including translation and voice, works without any key.

## Translation and voice

Three layers, in the order the app tries them, each labelled in the UI so a learner always knows
what they are looking at:

| Layer | Source | Tier shown | Covers |
|---|---|---|---|
| Word graph | `data/` + `lib/db/vocabulary` | `verified` / `ai_suggested` | whatever has been seeded |
| Machine translation | Google Translate, keyless (`lib/translation/google.ts`) | `machine_generated` | Kiswahili, Dholuo, Somali, Oromo (Borana/Orma) |
| — | nothing invented | `not_available` | everything else |

The graph always wins; Google is only asked when the graph has nothing. Google's endpoint accepts
some codes it does not actually translate (Gikuyu, for one) and echoes the input back — that is
detected and discarded rather than shown as a translation.

Voice is likewise split, and neither half needs an API key:

- **Speaking to the app** — the browser's Web Speech API (`components/voice/VoiceInput`). Chrome
  and Edge have it; where it is missing the button is not rendered at all.
- **The app speaking** — `/api/speech` proxies Google Translate's TTS, which has a Kiswahili and
  an English voice. For anything else the client falls back to the device's own synthesiser, and
  says so when there is no voice at all.

`SpeakButton` is a **machine** voice and is labelled that way everywhere. It is deliberately
separate from `PronunciationButton`, which plays licensed native-speaker recordings only and
still refuses to synthesise (docs/spec.md §2.4).

### Known limits before a public launch

- Accounts: learner state lives in an httpOnly cookie (`lib/session`). The Account step collects a
  contact but does not authenticate; wire Supabase Auth (phone-first) into `lib/session` next.
- Content: lessons are an orientation course and vocabulary is a small unverified Kiswahili seed.
  Real lessons, audio and translations come from the Kencorpus / Common Voice import pipeline.
- The tutor rate limit is per server instance.

## Layout

```text
app/(app)/            screens behind the onboarding gate, sharing the app shell
app/onboarding/       the gated first-run flow
app/api/              route handlers
components/           UI, grouped by domain
data/                 seed registry, vocabulary, books, counties
lib/db/               data access (registry, vocabulary, library, culture, community, contributions)
lib/session/          learner session, streak rules, server actions
lib/ai/               tutor orchestrator
lib/translation/      concept-graph translation
lib/search/           knowledge-graph search
proxy.ts              onboarding gate
supabase/             migrations and generated seed
```
