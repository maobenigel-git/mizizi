"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/*
 * Dictation, through the browser's Web Speech API. It runs on the device (or
 * the browser vendor's own service) and needs no key of ours, which is why it
 * is the input half of the voice features.
 *
 * Support is uneven — Chrome and Edge have it, Firefox does not — so the button
 * renders nothing at all where the API is missing, leaving the typed input as
 * the only affordance rather than a dead control.
 */

// The API is still prefixed in Chrome and is not in lib.dom's types.
type RecognitionEvent = { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

/* Whether the browser has the API never changes after load, so the store never
   fires — but going through useSyncExternalStore keeps the server snapshot
   (false) and the client's first render in agreement. */
const noChange = () => () => {};
const readSupported = () => Boolean(recognitionCtor());

export function VoiceInput({
  /** Called with the final transcript once the speaker stops. */
  onTranscript,
  /** Called with partial text while they are still talking, for a live preview. */
  onInterim,
  localeTag,
  label = "Speak",
  className = "",
}: {
  onTranscript: (text: string) => void;
  onInterim?: (text: string) => void;
  /** Undefined = no dictation locale for this language; the mic is hidden. */
  localeTag?: string;
  label?: string;
  className?: string;
}) {
  const supported = useSyncExternalStore(noChange, readSupported, () => false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);

  // Stop dictation if the control unmounts mid-sentence.
  useEffect(() => () => recognition.current?.stop(), []);

  function toggle() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Ctor = recognitionCtor();
    if (!Ctor || !localeTag) return;

    const rec = new Ctor();
    rec.lang = localeTag;
    rec.continuous = false;
    rec.interimResults = Boolean(onInterim);
    rec.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) final += text;
        else interim += text;
      }
      if (interim && onInterim) onInterim(interim);
      if (final) onTranscript(final.trim());
    };
    rec.onerror = (event) => {
      // "aborted" is what a deliberate stop looks like; not worth reporting.
      if (event.error === "aborted") return;
      setError(
        event.error === "not-allowed"
          ? "Microphone blocked. Allow access in your browser settings."
          : event.error === "no-speech"
            ? "Didn't catch that. Try again."
            : "Dictation failed. Try again.",
      );
    };
    rec.onend = () => setListening(false);

    recognition.current = rec;
    setError(null);
    setListening(true);
    rec.start();
  }

  // No API, or no locale we can honestly dictate in: offer nothing.
  if (!supported || !localeTag) return null;

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        aria-pressed={listening}
        aria-label={listening ? "Stop listening" : `${label} — dictate instead of typing`}
        className={`press inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ease-out ${
          listening
            ? "border-red bg-red/10 text-red"
            : "border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] text-[var(--accent-on-glass)] hover:border-accent"
        }`}
      >
        <span className="relative flex h-4 w-4 items-center justify-center">
          {listening && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red/40" />}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="relative h-4 w-4">
            <path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3ZM5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </span>
        {listening ? "Listening…" : label}
      </button>
      {error && (
        <span role="status" className="text-xs text-red">
          {error}
        </span>
      )}
    </span>
  );
}
