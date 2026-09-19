# Kenya Language & Culture Platform — Full Architecture & Build Spec
**Combined document for Fable** · core architecture + onboarding/gamification/community layer

> Character/persona design (mascots, tutor personas, achievement characters) is being handled in a separate follow-up brief — do not lock in illustration style or avatar sets based on this document alone.

---

# PART 1 — CORE PLATFORM ARCHITECTURE

## 1.1 Defining "68 Kenyan languages"

The commonly cited figure is 68, but it isn't a fixed, universally agreed number — Ethnologue is the usual source for it, while Kencorpus describes Kenya as having "68 or more" languages, and classifications split language clusters and dialects differently (this matters especially for Luhya and Kalenjin, which are clusters of related varieties rather than single uniform languages).

**Don't hard-code "Kenya has exactly 68 languages."** Use framing like "Explore Kenya's languages" and maintain a language registry where languages can be added, merged, split, or marked as dialects/varieties over time.

## 1.2 High-level architecture

```text
                         ┌──────────────────────┐
                         │     NEXT.JS APP      │
                         │      TypeScript      │
                         └──────────┬───────────┘
                                    │
             ┌──────────────────────┼─────────────────────┐
             │                      │                     │
             ▼                      ▼                     ▼
       LANGUAGE LEARNING       CULTURE & HERITAGE     DIGITAL LIBRARY
             │                      │                     │
             ▼                      ▼                     ▼
       Lessons / Quiz          Communities             Books
       Pronunciation           History                 Excerpts
       Speaking                Geography               Translations
       Vocabulary              Traditions               Metadata
       Grammar                 Food/Music              Search
             │                      │                     │
             └──────────────┬───────┴─────────────────────┘
                            ▼
                    KNOWLEDGE LAYER
                            │
                 ┌──────────┴──────────┐
                 │                     │
                 ▼                     ▼
          STRUCTURED DATA         VECTOR SEARCH
          PostgreSQL              pgvector
                 │                     │
                 └──────────┬──────────┘
                            ▼
                      AI ORCHESTRATOR
                            │
                       Claude/Fable
                            │
             ┌──────────────┼──────────────┐
             ▼              ▼              ▼
          Tutor         Translator      Cultural AI
             │              │              │
             └──────────────┼──────────────┘
                            ▼
                    Speech / Audio Layer
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
             STT/ASR                 TTS/audio
```

**Core idea: Claude should sit on top of your verified knowledge, not become your source of truth.**

## 1.3 Core database

PostgreSQL + pgvector (Supabase is a reasonable way to move quickly).

```text
languages
language_varieties
language_families

communities
regions
language_regions

vocabulary
phrases
sentences
grammar_rules

pronunciations
audio_recordings
speakers

lessons
lesson_items
quizzes
questions

cultural_topics
traditions
foods
music
clothing
festivals
history
oral_literature
proverbs

people
places
books
authors
book_excerpts
translations

sources
licenses
citations

users
user_progress
user_streaks
user_xp
user_answers

ai_conversations
ai_feedback
```

Every piece of linguistic/cultural data carries a source:

```json
{
  "term": "...",
  "language": "kln",
  "meaning": "...",
  "pronunciation": "...",
  "audio": "...",
  "source_id": "...",
  "source_type": "kencorpus",
  "license": "CC0",
  "verified": true
}
```

## 1.4 Language registry (no hard-coded pages)

```typescript
type Language = {
  id: string
  name: string
  nativeName?: string
  iso639_3?: string
  family: LanguageFamily
  status: "active" | "endangered" | "revitalization"
  varieties?: LanguageVariety[]
  regions: Region[]
  speakers?: number
  description: string
  sources: Source[]
}
```

One generic route (`/languages/[language]`) renders every language — no duplicated frontend per language.

## 1.5 Data coverage tiers

Don't promise every language will have full data on day one. Use three honest tiers:

- **Level 1 — Full learning language:** vocabulary, phrases, sentences, pronunciation, audio, grammar, lessons, cultural material, translation pairs.
- **Level 2 — Developing language:** vocabulary, text, some pronunciation, cultural material.
- **Level 3 — Heritage profile:** language profile, community, geography, history, cultural material, source links only.

UI message: "Data coverage varies by language. Help us expand your language." Better than inventing data.

## 1.6 Language families (initial scope)

- **Bantu:** Kiswahili, Gikuyu, Kamba, Ekegusii, Meru varieties, Embu, Mijikenda varieties, Luhya varieties, Taita.
- **Nilotic:** Dholuo, Kalenjin cluster, Maasai, Samburu, Turkana, Teso.
- **Cushitic:** Somali, Borana, Orma, Rendille, El Molo, Dahalo, others.

Kencorpus itself organizes its repository around Bantu, Cushitic and Nilotic communities, among others.

## 1.7 Language data sources

**Kencorpus** — primary institutional linguistic source. Audio, text, lexical data, transcriptions, linguistic descriptions, sociolinguistic material. The original project collected 4,442 texts across Kiswahili, Dholuo and three Luhya varieties, plus 1,152 spontaneous-speech files totaling over 176 hours. It does **not** give you a complete 68-language dataset on its own — it's one layer among several.

**Mozilla Common Voice** (via Kencorpus) — main pronunciation/audio source, CC0-licensed, with the restriction that users must not attempt to identify speakers:
- Kalenjin: 70,042 clips, 88.12 hours (40.65 validated), 41 speakers, 29,961 sentences.
- Swahili: 730,187 clips, 1,064 hours (392 validated), 1,518 speakers, 140,486 sentences.
- Kidaw'ida: 49,630 clips, 55.95 hours (9.31 validated).

**AfriVoices-KE** — a strong future source: ~3,000 hours of speech across Dholuo, Kikuyu, Kalenjin, Maasai, and Somali, from 4,777 native speakers, both scripted and spontaneous. Contributors include Maseno University (Dholuo/Somali), USIU-Africa (Maasai), Kabarak University (Kalenjin), and DeKUT/LDRI (Kikuyu). Check the dataset's actual license/terms before redistributing recordings.

**Hugging Face** — Kencorpus text dataset covering Kiswahili, Dholuo, Lumarachi, Lubukusu, Logooli, with fields `text`, `language`, `genre` (culture, news, creative writing, agriculture). Useful for the semantic-search/LLM layer.

## 1.8 Translation graph

Store translations as a shared-concept graph, not flat pairs:

```text
CONCEPT: GREETING_HELLO
   ├── Kiswahili → ...
   ├── Dholuo    → ...
   ├── Gikuyu    → ...
   ├── Kalenjin  → ...
   ├── Kisii     → ...
   └── Kamba     → ...
```

This lets Dholuo → Kisii resolve directly instead of round-tripping through English. But low-resource language pairs won't have enough parallel data for guaranteed direct translation everywhere, so every translation needs a confidence level:

```text
Verified
Community verified
Corpus supported
Machine generated
AI suggested
Not available
```

Never silently present an AI guess as a settled "Kenyan translation."

## 1.9 Culture knowledge graph

```text
Community
   ├── Language
   ├── Regions
   ├── History
   ├── Food
   ├── Clothing
   ├── Music
   ├── Dance
   ├── Festivals
   ├── Oral traditions
   ├── Proverbs
   ├── Crafts
   ├── Names
   ├── Geography
   └── Notable people
```

Every claim carries `source`, `author`, `publication`, `date`, `community validation`, `license`. Frame content as "Kikuyu cultural traditions," not sweeping claims about "Kenyan culture" as one thing.

## 1.10 The learning loop

For a given word, the lesson sequence is: **Language** (learn the word) → **Pronunciation** (hear a native speaker) → **Context** (see it used) → **Culture** (cultural context) → **Challenge** (contextual question) → **Conversation** (talk to the AI tutor).

## 1.11 Books & Kenyan literature — copyright-aware library

**This is the part that needs the most care.** You cannot upload every Kenyan book you can find.

- *Facing Mount Kenya* (Jomo Kenyatta, d. 1978): under Kenya's Copyright Act, literary works generally get protection for 50 years after the author's year of death — check the actual rights position before treating this as free to digitize.
- Ngũgĩ wa Thiong'o died in May 2025 — his works (*Weep Not, Child*, *Petals of Blood*, *The River Between*, *A Grain of Wheat*, *Decolonising the Mind*, *Wizard of the Crow*, etc.) are nowhere near the end of their copyright term. Don't scrape and store full text.
- Translation is not a loophole — a translation/adaptation is itself a copyright-controlled use under Kenyan law.

**Rights-aware library categories:**
- **Category A — Public domain:** full text potentially available.
- **Category B — Open licence:** full text per the license terms.
- **Category C — Licensed:** permission obtained from publisher/author/estate.
- **Category D — Copyrighted:** metadata + legally permitted excerpts + link to purchase/read.

Example book page: title, author, category tags (Cultural history / Gikuyu / 1938), a short "about this book" summary, a list of explorable concepts (Gikuyu social structure, Agriculture, Kinship, Ceremonies), and a link to the publisher/library rather than the full text.

**Better framing than "ebook reader":** "Learn through Kenyan literature" — for a licensed book, the AI generates key vocabulary, historical context, cultural concepts, language comparison, a quiz, discussion prompts, and translation exercises tied to a chapter, making literature part of the education system rather than just hosted content.

**Potential library categories to grow into:** Kenyan literature (Ngũgĩ wa Thiong'o, Grace Ogot, Meja Mwangi, Micere Githae Mugo, Marjorie Oludhe Macgoye, Binyavanga Wainaina, Yvonne Adhiambo Owuor, Abdilatif Abdalla, Wahome Mutahi); historical/ethnographic works (Jomo Kenyatta, Louis Leakey, early missionary/colonial linguistic records where legally usable, historical dictionaries, linguistic surveys); and community-contributed oral literature (folktales, proverbs, riddles, songs, oral histories, children's stories) collected with explicit contributor/community permission — potentially one of the platform's strongest datasets long-term.

Search example: a user searching "Kenyan literature related to Gikuyu culture" should traverse Book → Author → Language → Community → Historical period → Places → Cultural topics → Vocabulary.

## 1.12 Repo structure

```text
kenya-language-platform/
│
├── app/
│   ├── page.tsx
│   │
│   ├── languages/
│   │   ├── page.tsx
│   │   └── [language]/
│   │       ├── page.tsx
│   │       ├── learn/
│   │       ├── culture/
│   │       ├── heritage/
│   │       ├── pronunciation/
│   │       └── translate/
│   │
│   ├── explore/
│   ├── culture/
│   ├── heritage/
│   ├── translate/
│   ├── literature/
│   │   └── [book]/
│   │
│   ├── learn/
│   │   └── [course]/
│   │
│   ├── practice/
│   └── api/
│       ├── languages/
│       ├── lessons/
│       ├── translate/
│       ├── pronunciation/
│       ├── culture/
│       ├── literature/
│       └── ai/
│
├── components/
│   ├── language/
│   ├── lessons/
│   ├── pronunciation/
│   ├── culture/
│   ├── heritage/
│   ├── translator/
│   └── literature/
│
├── lib/
│   ├── db/
│   ├── ai/
│   ├── search/
│   ├── speech/
│   ├── translation/
│   └── sources/
│
├── data/
│   ├── languages/
│   ├── lessons/
│   └── seed/
│
└── types/
```

## 1.13 AI orchestration

The frontend never talks to Claude directly. Flow:

```text
User → Next.js API → AI Orchestrator → Retrieve verified language data
     → Retrieve cultural context → Retrieve user level → Claude/Fable
     → Structured response → Frontend
```

Effective system-prompt rule for the tutor:

```text
You are a Kenyan language tutor.
Never invent a translation.
Use VERIFIED_LANGUAGE_DATA as the linguistic source of truth.
Use CULTURAL_CONTEXT only when supported by cited sources.
If no verified translation exists, return "translation_unavailable".
Do not fabricate one.
Adapt the lesson to the learner's proficiency.
```

## 1.14 Speech architecture

```text
Microphone → Speech-to-text → Detected language → Pronunciation analysis → Score → Feedback
```

Realism by difficulty: playing native recordings is easy; speech transcription is possible for better-resourced languages; reliable pronunciation scoring across all 68 languages is hard; high-quality TTS for all 68 is very hard; accurate ASR for extremely low-resource/endangered languages is research-level. AfriVoices-KE is strategically valuable here since it's explicitly built to support ASR/TTS development for its five covered languages.

## 1.15 APIs

```text
GET  /api/languages
GET  /api/languages/:id
GET  /api/languages/:id/lessons
GET  /api/languages/:id/vocabulary
GET  /api/languages/:id/culture
GET  /api/languages/:id/audio
POST /api/translate
POST /api/pronunciation
POST /api/lesson/generate
POST /api/conversation
GET  /api/books
GET  /api/books/:id
GET  /api/search
```

Grouped internally as: Language API, Culture API, Literature API, Translation API, AI Tutor API, Speech API.

## 1.16 Search

Postgres full-text search + pgvector initially; move to OpenSearch/Elasticsearch only if the corpus grows large enough to need it. A query like "marriage traditions among the Kalenjin" should surface a cultural article, the Kalenjin language, related vocabulary, a related proverb, related literature, and audio — the knowledge graph doing the connecting.

## 1.17 Realistic scope check

**Very possible now:** 68-language catalogue, language family mapping, community profiles, geographic mapping, vocabulary where data exists, Duolingo-style lessons, XP/streaks/progress, a properly sourced culture database, translation between languages with adequate parallel data, an AI tutor, verified AI-generated exercises, native audio where licensing permits, a digital library catalogue, book summaries from lawful sources, community contributions.

**Possible, but needs substantial data first:** direct translation between all 68 languages, pronunciation scoring, ASR/TTS across all 68, an equal-quality grammar tutor for every language, cultural AI without rigorous source grounding.

**Don't promise yet:** "we've solved translation for all 68 Kenyan languages," "our AI can accurately pronounce every Kenyan language," "we've digitized Kenya's entire literary heritage." Safer framing: *"We are building the infrastructure to make Kenya's languages, cultures and literary heritage digitally accessible, beginning with the languages for which high-quality data already exists."*

## 1.18 The real product shape

Three products on one shared knowledge graph:

```text
                 KENYA
                   │
        ┌──────────┼──────────┐
        │          │          │
     LANGUAGES   CULTURE   LITERATURE
        │          │          │
        └──────────┼──────────┘
                   │
              KNOWLEDGE
                GRAPH
                   │
          ┌────────┼────────┐
          │        │        │
        LEARN   TRANSLATE  AI
          │        │        │
          └────────┼────────┘
                   │
                USERS
```

**Learn** (Duolingo-style), **Discover** (culture, communities, history, heritage), **Connect** (translation, cross-language communication) — with the Kenyan Language & Cultural Knowledge Graph underneath all three as the actual moat.

**Phasing decision:** don't try to make all 68 languages equally deep from day one. Ship the full 68-language shell, but build deep infrastructure around roughly 5 languages first — Kiswahili + Dholuo + Gikuyu + Kalenjin + one Luhya variety — since these already have meaningful text/speech resources across Kencorpus, Common Voice, and AfriVoices-KE. Then: **68 languages listed → 5 deeply supported → progressively expand.**

Keep the literature layer's licensing completely separate from the language-corpus licensing — Kencorpus data may be reusable under its own license, while a book like a Ngũgĩ work is a separate copyrighted work under a life-plus-50-year term. "It's an old Kenyan book" is not sufficient grounds to treat it as free to digitize and translate.

**Suggested next artifact after this one:** a data acquisition matrix — all 68 language entries × text source × audio source × pronunciation availability × translation pairs × cultural sources × licence × API/download URL × verification status. That becomes the master blueprint for the whole content pipeline.

---

# PART 2 — ONBOARDING, GAMIFICATION & COMMUNITY LAYER

## 2.1 Streaks

**Rule:** A streak increments once per calendar day (user's local timezone) the first time they complete any qualifying action — one lesson, one quiz, or one notebook review session. Multiple activities in a day add XP, not extra streak count.

**Grace mechanics:** 1 free streak freeze earned per 7-day streak, capped at 3 banked. Missing a day with no freeze available resets the streak to 0, but `longest_streak` persists permanently on the profile.

**UI:** Flame icon + number, always visible in top nav. On increment: scale-pop + flame flicker (200–300ms) — full-screen celebration reserved for milestones only (7, 30, 100, 365 days). A streak-at-risk state (no activity yet today, after ~6pm local) gets a subtle color shift on the icon; no nagging push copy in v1.

```
user_streaks (user_id, current_streak, longest_streak, freezes_banked, last_activity_date)
```

## 2.2 Login & Onboarding Flow

Five linear screens, ~90 seconds total, no dead ends:

| Step | Screen | Fields / Choices | Notes |
|---|---|---|---|
| 1 | Welcome | — | One-sentence value prop + Continue / I have an account |
| 2 | Account | Email or phone, password *or* Google OAuth | Prioritize phone auth for the Kenyan market |
| 3 | Profile | Display name, avatar, optional home county | County is optional but feeds community matching later |
| 4 | Choose a language | Searchable grid, grouped by family (Bantu/Nilotic/Cushitic), coverage-tier badge per card (Full/Developing/Heritage) | Show low-coverage languages honestly rather than hiding them |
| 5 | Choose your level | 3 cards: New to this language / I understand some / I speak it, want to read & write | Maps internally to Beginner/Intermediate/Advanced; skip a placement test in v1 |

After step 5 → straight into one sample lesson, no separate dashboard tour.

```
onboarding_profile (user_id, display_name, avatar, county, chosen_language_id, self_reported_level, completed_at)
```

## 2.3 Visual Theme

| Role | Color | Hex (suggested) | Use |
|---|---|---|---|
| Primary | Ocean Blue | `#1B6CA8` | Primary buttons, active nav, links |
| Primary Dark | Deep Ocean | `#0D3B54` | Header/nav background, dark-mode base |
| Secondary | Earth Brown / Terracotta | `#A8552E` | Culture/heritage sections, secondary buttons, badges |
| Accent | Savanna Gold | `#E0A93A` | Streaks, XP, achievements only — used sparingly |
| Success | Acacia Green | `#3F7D4F` | Correct answers, progress bars |
| Surface | Warm Sand | `#F7F1E8` | Light-mode background, replaces plain white |
| Text | Charcoal | `#232323` | Body copy |

**Rule for Fable:** Ocean Blue = learning/progression screens; Earth Brown = culture/heritage/community screens. This gives free wayfinding — users learn "brown = heritage content" without being told. Keep it to these six colors plus neutrals; don't add a color per language family.

## 2.4 Popups

**Word of the Day** — once/day, first open, dismissible, never blocks navigation. Content: word, pronunciation audio, one example sentence, one line of cultural context, language badge. Single action: "Save to notebook." Pulls from the existing `vocabulary` table.
```
word_of_day (id, language_id, word_id, shown_date)
```

**Notebook** — a personal, cross-language save-list, always one tap away via a bookmark icon. Any word/phrase/sentence anywhere gets a save affordance. View is grouped by language, filterable by auto-tag (from lesson / from Word of the Day / from culture article). Built-in "Quiz me on these" generates a mini review session from saved items only — the main retention hook.
```
notebook_entries (id, user_id, item_type [word|phrase|sentence], item_id, source, saved_at)
```

**Pronunciation Teacher** — triggered by tapping a word's speaker icon, not an unprompted popup. v1: native audio + slowed-down (0.7x) version + phonetic spelling — achievable wherever Common Voice/Kencorpus audio exists. v2 (limited to the 5 initially-deep-supported languages): record-yourself + basic similarity score, explicitly framed as practice feedback, never a certified pronunciation grade. No mouth/tongue-position diagram in v1 — high cost, low coverage; revisit after the first 5 languages.

## 2.5 Community Matching & Data Collection

**What's practical immediately:** a read-only discovery directory matching users by language pair, rough region, and shared interest tags from onboarding — cheap to build, no moderation burden. Alongside it, structured contribution prompts ("Help translate this phrase," "Is this proverb from your community?", "Record yourself saying this word") — bounded tasks with a clear data output, feeding the `community_verified` confidence tier from Part 1.

**What needs real thought before shipping:** open messaging between matched users is a different risk category — safety, harassment handling, a reporting flow, likely a person responsible for moderation. Kenya's Data Protection Act (2019) and app-store review both expect a reporting mechanism before strangers can message each other, more so with a userbase that includes students who may be minors. Defer open chat, or launch it invite-only inside verified communities (a university club, a language association) rather than open to all users. County/language/interest tags are low-risk to collect; anything closer to behavioral tracking or profiling needs its own explicit consent screen, not a line buried in general terms of service. Sustained high-quality contribution usually needs recognition (leaderboards, "Verified Contributor" badge, source credit) or eventually a small payment/airtime model — decide this before launch rather than retrofitting it after people have already contributed for free.

**Recommended phasing:**
1. **Phase 1 (ship with v1):** static discovery directory + structured micro-contribution tasks, no messaging.
2. **Phase 2:** invite-only group spaces per community org, with basic moderation tools.
3. **Phase 3:** open 1:1 messaging, only once a reporting/moderation flow (and someone responsible for it) exists.

```
community_profiles (user_id, speaks_languages[], learning_languages[], county, interests[], contributor_verified)
contribution_tasks (id, type [translate|verify|record|proverb], language_id, prompt, status)
contribution_submissions (id, task_id, user_id, content, confidence_tier, reviewed_by, created_at)
```

## 2.6 Animation Direction

- Screen transitions: 200–300ms ease-out, no elastic/bounce easing.
- Correct answer: small scale-pop + green flash, 150ms.
- Streak increment: flame scale-pop (§2.1).
- Popup entry: slide-up + fade, 250ms, never a hard cut.
- Loading states: skeleton screens (not spinners) for knowledge-graph content (culture pages, book pages).
- Budget: no more than 2 simultaneous animated elements per screen.
