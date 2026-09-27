"use client";

import { useEffect, useRef, useState } from "react";
import { scorePronunciation, type PronunciationScore } from "@/lib/lessons/scoring";

/*
 * "Speak to Mizizi" — the live voice demo on Home.
 *
 * Browser-only: the Web Speech API hears the learner (Chrome and Edge have
 * it), the transcript is compared with the target word, and speechSynthesis
 * answers — "Vizuri sana!" and the word, or "Jaribu tena" and the word again
 * to repeat. Where the device has no voice for the language, the app's own
 * /api/speech voice is used so the reply is never silent.
 *
 * It checks whether the recogniser understood the word, not accent — same as
 * the lessons' browser fallback.
 */

/*
 * Stricter than the lessons (which pass at 80 to forgive a recogniser's
 * spelling): here a single wrong sound — "kalibu" for "karibu" — should be
 * caught and repeated.
 */
const PASS = 90;

export type DemoLanguage = {
  id: string;
  name: string;
  /** BCP-47 tag for recognition and the voice, e.g. "sw-KE". */
  tag: string;
  words: { text: string; meaning: string }[];
  say: { great: string; retry: string; prompt: string; heard: string };
};

type Recognition = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionCtor(): (new () => Recognition) | undefined {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/** Voices load asynchronously in Chrome; wait briefly for them. */
async function voices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  if (!synth) return [];
  const now = synth.getVoices();
  if (now.length) return now;
  return new Promise((resolve) => {
    const done = () => resolve(synth.getVoices());
    synth.addEventListener("voiceschanged", done, { once: true });
    setTimeout(done, 1200);
  });
}

async function speak(text: string, language: DemoLanguage): Promise<void> {
  try {
    const all = await voices();
    const tag = language.tag.toLowerCase();
    const base = tag.split("-")[0];
    const voice =
      all.find((v) => v.lang.toLowerCase().replace("_", "-") === tag) ??
      all.find((v) => v.lang.toLowerCase().startsWith(base));
    if (voice) {
      window.speechSynthesis.cancel();
      await new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice;
        u.lang = voice.lang;
        u.rate = 0.9;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.speak(u);
      });
      return;
    }
    // No device voice for this language: use the app's own machine voice.
    const res = await fetch(`/api/speech?lang=${encodeURIComponent(language.id)}&text=${encodeURIComponent(text)}`);
    if (!res.ok) return;
    const url = URL.createObjectURL(await res.blob());
    const audio = new Audio(url);
    await new Promise<void>((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      void audio.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  } catch {
    // Speaking is best-effort; the result is on screen either way.
  }
}

export function SpeakToMizizi({ languages, initial }: { languages: DemoLanguage[]; initial: string }) {
  const [languageId, setLanguageId] = useState(initial);
  const language = languages.find((l) => l.id === languageId) ?? languages[0];
  const [index, setIndex] = useState(0);
  const target = language.words[index % language.words.length];
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [result, setResult] = useState<PronunciationScore | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    // Checked after mount so the server render and first client render agree.
    const id = setTimeout(() => setSupported(Boolean(recognitionCtor())), 0);
    return () => {
      clearTimeout(id);
      recognition.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function reset(nextIndex = index, nextLanguage = languageId) {
    recognition.current?.stop();
    setIndex(nextIndex);
    setLanguageId(nextLanguage);
    setHeard("");
    setResult(null);
    setMessage(null);
  }

  async function respond(alternatives: string[]) {
    // Judge the recogniser's best guess that matches the word — it often
    // offers the right spelling as a second alternative.
    const scored = alternatives.map((a) => scorePronunciation(a, target.text)).sort((a, b) => b.score - a.score);
    const best = scored[0];
    setHeard(best.heard || alternatives[0]);
    setResult(best);
    if (best.score >= PASS) {
      await speak(`${language.say.great} ${target.text}`, language);
    } else {
      await speak(`${language.say.heard} ${best.heard || "…"}. ${language.say.retry}. ${language.say.prompt} ${target.text}`, language);
    }
  }

  function listen() {
    try {
      const Ctor = recognitionCtor();
      if (!Ctor) {
        setSupported(false);
        return;
      }
      window.speechSynthesis?.cancel();
      recognition.current?.stop();
      const rec = new Ctor();
      rec.lang = language.tag;
      rec.interimResults = true;
      rec.maxAlternatives = 4;
      rec.continuous = false;
      let finals: string[] = [];
      rec.onresult = (e) => {
        let text = "";
        for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript;
        setHeard(text);
        const last = e.results[e.results.length - 1];
        if (last.isFinal) finals = Array.from({ length: last.length }, (_, i) => last[i].transcript).filter(Boolean);
      };
      rec.onerror = (e) => {
        setMessage(
          e.error === "not-allowed"
            ? "Microphone blocked — allow it in the address bar, then try again."
            : e.error === "no-speech"
              ? "Didn't hear anything — tap and speak a little louder."
              : `Couldn't listen (${e.error}). Try again.`,
        );
      };
      rec.onend = () => {
        setListening(false);
        if (finals.length) void respond(finals);
      };
      recognition.current = rec;
      setHeard("");
      setResult(null);
      setMessage(null);
      setListening(true);
      rec.start();
    } catch {
      setListening(false);
      setMessage("Couldn't start the microphone. Try again.");
    }
  }

  const correct = result !== null && result.score >= PASS;

  return (
    <section className="glass space-y-4 p-5 sm:p-6" aria-labelledby="speak-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="speak-title" className="text-xl font-semibold">
          Speak to Mizizi
        </h2>
        <div className="flex gap-1 rounded-full bg-[var(--glass-inset-bg)] p-1" role="radiogroup" aria-label="Language">
          {languages.map((l) => (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={l.id === languageId}
              onClick={() => reset(0, l.id)}
              className={`press rounded-full px-3 py-1 text-sm font-medium transition-colors duration-200 ease-out ${
                l.id === languageId ? "bg-accent-solid text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Say this</p>
          <p className="text-4xl font-semibold tracking-tight">{target.text}</p>
          <p className="text-muted">{target.meaning}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void speak(target.text, language)}
            className="press rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-accent"
          >
            🔊 Hear it
          </button>
          <button
            type="button"
            onClick={() => reset(index + 1)}
            className="press rounded-full border border-border bg-background px-4 py-2 text-sm font-medium hover:border-accent"
          >
            Next word →
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => (listening ? recognition.current?.stop() : listen())}
        disabled={!supported}
        className={`press flex w-full items-center justify-center gap-3 rounded-[var(--radius-control)] px-6 py-5 text-lg font-semibold text-white shadow-[0_14px_30px_-12px_var(--accent)] transition-all duration-200 ease-out disabled:opacity-40 ${
          listening ? "bg-red" : "bg-accent-solid hover:opacity-90"
        }`}
      >
        <span aria-hidden className={`text-2xl ${listening ? "animate-pulse" : ""}`}>
          🎤
        </span>
        {listening ? "Listening… tap to stop" : "Speak to Mizizi"}
      </button>

      {!supported && (
        <p className="text-sm text-red">This browser can&apos;t listen. Open the app in Chrome or Edge.</p>
      )}

      {(heard || listening) && (
        <div className="rounded-[var(--radius-control)] bg-[var(--glass-inset-bg)] px-4 py-3" aria-live="polite">
          <p className="text-sm text-muted">You said</p>
          <p className="text-2xl font-semibold">{heard || "…"}</p>
        </div>
      )}

      {result && (
        <div
          role="status"
          className={`animate-fade-in rounded-[var(--radius-control)] px-4 py-3 ${correct ? "bg-forest/10 text-forest" : "bg-red/10 text-red"}`}
        >
          <p className="text-lg font-semibold">
            {correct ? `✓ ${language.say.great}` : `✗ ${language.say.retry} — repeat after me: “${target.text}”`}
          </p>
          <p className="text-sm text-foreground">
            {result.score}% match
            {!correct && result.words.some((w) => !w.ok) && ` · check: ${result.words.filter((w) => !w.ok).map((w) => w.expected).join(", ")}`}
          </p>
          {!correct && (
            <button type="button" onClick={listen} className="press mt-2 rounded-full bg-accent-solid px-4 py-1.5 text-sm font-semibold text-white">
              Try again
            </button>
          )}
        </div>
      )}

      {message && <p className="text-sm text-red">{message}</p>}
    </section>
  );
}
