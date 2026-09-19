"use client";

import { useEffect, useRef, useState } from "react";

/*
 * Reads text aloud in a machine voice.
 *
 * Two sources, tried in order:
 *   1. /api/speech — Google Translate TTS, which has a Kiswahili voice.
 *   2. The browser's own speechSynthesis, where the device has a matching voice.
 *
 * Neither is a native speaker, and the button says so, because a synthesised
 * voice must never be mistaken for the recordings the Pronunciation Teacher
 * plays (docs/spec.md §2.4).
 */

type State = "idle" | "loading" | "playing" | "unavailable";

export function SpeakButton({
  text,
  languageId,
  /** BCP-47 tag for the browser fallback, e.g. "sw-KE". */
  localeTag,
  label = "Listen",
  className = "",
}: {
  text: string;
  languageId: string;
  /** BCP-47 tag for the device fallback. Undefined = no device voice either. */
  localeTag?: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<State>("idle");
  const audio = useRef<HTMLAudioElement | null>(null);

  // Stop the audio if the button goes away mid-phrase.
  useEffect(
    () => () => {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
    },
    [],
  );

  /**
   * Device voices, used only when Google has none for this language. Returns
   * false unless the device has a voice for THIS language — reading Dholuo in
   * an English voice would be worse than staying silent.
   */
  function speakLocally(): boolean {
    const synth = window.speechSynthesis;
    if (!synth || !localeTag) return false;
    const base = localeTag.split("-")[0];
    const voice = synth.getVoices().find((v) => v.lang === localeTag) ?? synth.getVoices().find((v) => v.lang.startsWith(base));
    if (!voice) return false;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = 0.95;
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("unavailable");
    synth.cancel();
    synth.speak(utterance);
    setState("playing");
    return true;
  }

  async function play() {
    if (state === "playing") {
      audio.current?.pause();
      window.speechSynthesis?.cancel();
      setState("idle");
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`/api/speech?lang=${encodeURIComponent(languageId)}&text=${encodeURIComponent(text)}`);
      if (!res.ok) {
        // 404 means no Google voice — that is expected, not an error.
        if (!speakLocally()) setState("unavailable");
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const el = new Audio(url);
      audio.current = el;
      el.onended = () => {
        setState("idle");
        URL.revokeObjectURL(url);
      };
      el.onerror = () => setState("unavailable");
      await el.play();
      setState("playing");
    } catch {
      if (!speakLocally()) setState("unavailable");
    }
  }

  if (state === "unavailable") {
    return <span className={`text-xs text-muted ${className}`}>No voice available for this language.</span>;
  }

  return (
    <button
      type="button"
      onClick={() => void play()}
      disabled={state === "loading"}
      aria-label={state === "playing" ? `Stop reading “${text}”` : `${label}: machine voice reading “${text}”`}
      title="Machine voice — not a native-speaker recording"
      className={`press inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-sm text-[var(--accent-on-glass)] transition-all duration-200 ease-out hover:border-accent disabled:opacity-50 ${className}`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
        {state === "playing" ? <path d="M9 6v12M15 6v12" /> : <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7" />}
      </svg>
      {state === "loading" ? "…" : label}
    </button>
  );
}
