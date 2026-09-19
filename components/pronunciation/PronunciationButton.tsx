"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Pronunciation Teacher v1 (docs/spec.md §2.4): tap the speaker for the native
 * recording, a 0.7x version and the phonetic spelling. Only ever plays real
 * recordings — where none is licensed yet it says so instead of synthesising.
 */
export function PronunciationButton({
  term,
  audioUrl,
  phonetic,
}: {
  term: string;
  audioUrl?: string;
  phonetic?: string;
}) {
  const [open, setOpen] = useState(false);
  const audio = useRef<HTMLAudioElement>(null);

  function play(rate: number) {
    const el = audio.current;
    if (!el) return;
    el.playbackRate = rate;
    el.preservesPitch = true;
    el.currentTime = 0;
    void el.play();
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`Hear “${term}”`}
        className="rounded-full border border-border bg-background p-2 text-accent transition-colors duration-200 ease-out hover:border-accent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
          <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12" />
        </svg>
      </button>

      {open && (
        <span role="dialog" aria-label={`Pronunciation of ${term}`} className="absolute left-0 top-full z-20 mt-2 block w-64 animate-fade-in space-y-3 rounded-xl border border-border bg-background p-4 text-left shadow-lg">
          <span className="block text-lg font-semibold">{term}</span>
          {phonetic && <span className="block font-mono text-sm text-muted">/{phonetic}/</span>}
          {audioUrl ? (
            <span className="flex gap-2">
              <audio ref={audio} src={audioUrl} preload="none" />
              <button type="button" onClick={() => play(1)} className="flex-1 rounded-lg bg-accent-solid px-3 py-2 text-sm font-medium text-white">
                Play
              </button>
              <button type="button" onClick={() => play(0.7)} className="flex-1 rounded-lg border border-accent px-3 py-2 text-sm font-medium text-accent">
                Slow 0.7×
              </button>
            </span>
          ) : (
            <span className="block space-y-2 text-sm text-muted">
              <span className="block">No native-speaker recording for this word yet.</span>
              <Link href="/community/contribute" className="block font-medium text-accent hover:underline">
                Help record it →
              </Link>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
