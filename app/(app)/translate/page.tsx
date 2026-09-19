import type { Metadata } from "next";
import Link from "next/link";
import { PronunciationButton } from "@/components/pronunciation/PronunciationButton";
import { TranslateField } from "@/components/translate/TranslateField";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { listLanguages } from "@/lib/db/languages";
import { listVocabulary } from "@/lib/db/vocabulary";
import { getSession } from "@/lib/session";
import { toggleNotebook } from "@/lib/session/actions";
import { dictationTagFor, hasMachineVoice, speechTagFor } from "@/lib/speech/voices";
import { confidenceLabels, ENGLISH, machineTranslationAvailable, translate } from "@/lib/translation";
import type { ConfidenceTier } from "@/types";

export const metadata: Metadata = { title: "Translate · Mizizi" };

const tierStyles: Record<ConfidenceTier, string> = {
  verified: "bg-forest/15 text-forest",
  community_verified: "bg-forest/15 text-forest",
  corpus_supported: "bg-ocean/15 text-ocean",
  machine_generated: "bg-border text-foreground",
  ai_suggested: "bg-border text-foreground",
  not_available: "bg-red/10 text-red",
};

const select = "glass-inset w-full px-3 py-2.5 outline-none transition-all duration-200 ease-out focus:border-accent";

export default async function TranslatePage({ searchParams }: PageProps<"/translate">) {
  const [params, languages, session, words] = await Promise.all([searchParams, listLanguages(), getSession(), listVocabulary()]);
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const q = str(params.q).slice(0, 200);
  const from = str(params.from) || ENGLISH;
  const to = str(params.to) || session.languageId || "kiswahili";
  const nameOf = (id: string) => (id === ENGLISH ? "English" : (languages.find((l) => l.id === id)?.name ?? id));

  const result = q ? await translate(q, from, to) : undefined;
  const word = result?.text ? words.find((w) => w.languageId === (to === ENGLISH ? from : to) && w.conceptId === result.conceptId) : undefined;
  const options = [{ id: ENGLISH, name: "English" }, ...languages];

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Translate</h1>
        <p className="text-muted">
          Translations come only from our checked word graph, each with a confidence label. We never show a guess as
          a settled translation.
        </p>
      </header>

      <form action="/translate" className="glass space-y-4 p-5 sm:p-6">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">From</span>
            <select name="from" defaultValue={from} className={select}>
              {options.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <Link
            href={`/translate?from=${to}&to=${from}${result?.text ? `&q=${encodeURIComponent(result.text)}` : ""}`}
            aria-label="Swap languages"
            className="mb-1 rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] p-2 text-muted transition-colors duration-200 ease-out hover:border-accent hover:text-accent"
          >
            ⇄
          </Link>
          <label className="space-y-1">
            <span className="text-sm font-medium">To</span>
            <select name="to" defaultValue={to} className={select}>
              {options.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <TranslateField defaultValue={q} localeTag={dictationTagFor(from)} />
        <button
          type="submit"
          className="w-full rounded-[var(--radius-control)] bg-accent-solid px-5 py-3 font-semibold text-white shadow-[0_8px_20px_-8px_var(--accent)] transition-all duration-200 ease-out hover:opacity-90"
        >
          Translate
        </button>
      </form>

      {result && (
        <section className="glass animate-fade-in space-y-4 p-5 sm:p-6" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted">
              {nameOf(from)} → {nameOf(to)}
            </h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${tierStyles[result.confidence]}`}>
              {confidenceLabels[result.confidence]}
            </span>
          </div>

          {result.text ? (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-3xl font-semibold tracking-tight">{result.text}</p>
                {word && to !== ENGLISH && <PronunciationButton term={word.term} audioUrl={word.audioUrl} phonetic={word.phonetic} />}
                {/* Known server-side, so a language with no voice gets no
                    button rather than one that fails when tapped. */}
                {hasMachineVoice(to) && <SpeakButton text={result.text} languageId={to} localeTag={speechTagFor(to)} />}
              </div>
              {result.example && (
                <blockquote className="border-l-2 border-accent pl-3 text-sm">
                  <p>{result.example.text}</p>
                  <p className="text-muted">{result.example.meaning}</p>
                </blockquote>
              )}
              {result.confidence === "ai_suggested" && (
                <p className="text-sm text-muted">This entry has not been checked by a speaker yet. Treat it as a suggestion.</p>
              )}
              {result.engine === "google" && (
                <p className="rounded-[var(--radius-control)] bg-[var(--glass-inset-bg)] px-3 py-2 text-sm text-muted">
                  Our word graph has no entry for this yet, so this came from Google Translate. It is machine output,
                  not a checked {nameOf(to)} translation — useful for the gist, not for a name, a proverb or anything
                  you need to get right.
                </p>
              )}
              {word && (
                <form action={toggleNotebook.bind(null, word.id, "translate")}>
                  <button type="submit" className="rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent/10">
                    {session.notebook.some((e) => e.id === word.id) ? "Saved to notebook" : "Save to notebook"}
                  </button>
                </form>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-lg font-medium">No translation for “{q}” yet.</p>
              <p className="text-sm text-muted">
                {machineTranslationAvailable(from, to)
                  ? "Neither our word graph nor Google Translate had an answer for this one."
                  : `Our word graph has no entry, and no machine translator covers ${nameOf(to === ENGLISH ? from : to)} either.`}{" "}
                We would rather say so than invent one. If you speak {nameOf(to === ENGLISH ? from : to)}, you can add it.
              </p>
              <Link href="/community/contribute" className="inline-block text-sm font-medium text-accent hover:underline">
                Help translate →
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
