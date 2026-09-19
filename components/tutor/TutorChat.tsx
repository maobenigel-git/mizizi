"use client";

import { useEffect, useRef, useState } from "react";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { VoiceInput } from "@/components/voice/VoiceInput";
import { dictationTagFor, speechTagFor } from "@/lib/speech/voices";
import { ENGLISH } from "@/lib/translation/codes";

type Turn = { role: "user" | "assistant"; content: string };

/** Talks to /api/conversation only — the model is never called from the browser. */
/*
 * English is the language of instruction (lib/ai/tutor RULES), so both halves
 * of voice here are English: the learner asks in English, and replies — which
 * are English prose quoting the target language — are read in an English voice.
 * Reading them in the target language's voice would mangle the explanation.
 */
const TUTOR_VOICE = ENGLISH;

export function TutorChat({ languageName, starters }: { languageName: string; starters: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [turns, pending]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const history = [...turns, { role: "user" as const, content }];
    setTurns(history);
    setDraft("");
    setNotice(null);
    setPending(true);
    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const reply = await res.json();
      if (reply.status === "ok") setTurns([...history, { role: "assistant", content: reply.text }]);
      else setNotice(reply.message ?? "The tutor is unavailable right now.");
    } catch {
      setNotice("Could not reach the tutor. Check your connection.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex-1 space-y-3">
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-muted">Ask your {languageName} tutor anything. Try:</p>
            <div className="flex flex-wrap gap-2">
              {starters.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3.5 py-2 text-sm backdrop-blur transition-all duration-200 ease-out hover:border-accent hover:text-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {turns.map((turn, i) => (
          <div key={i} className={`flex w-fit max-w-[85%] flex-col gap-1.5 ${turn.role === "user" ? "ml-auto items-end" : ""}`}>
            <p
              className={`animate-fade-in whitespace-pre-wrap rounded-[1.25rem] px-4 py-2.5 ${
                turn.role === "user"
                  ? "bg-accent-solid text-white shadow-[0_8px_20px_-10px_var(--accent)]"
                  : "glass !rounded-[1.25rem]"
              }`}
            >
              {turn.content}
            </p>
            {/* The tutor teaches in English but quotes the language; hearing it back helps. */}
            {turn.role === "assistant" && (
              <SpeakButton text={turn.content} languageId={TUTOR_VOICE} localeTag={speechTagFor(TUTOR_VOICE)} label="Read aloud" className="!py-1 !text-xs" />
            )}
          </div>
        ))}
        {pending && <p className="glass w-fit animate-pulse !rounded-[1.25rem] px-4 py-2.5 text-muted">Thinking…</p>}
        {notice && (
          <p role="status" className="rounded-[var(--radius-control)] border border-red/40 bg-red/10 px-4 py-3 text-sm text-red">
            {notice}
          </p>
        )}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="glass sticky bottom-20 flex flex-col gap-2 p-2 sm:bottom-4"
      >
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={1000}
            placeholder="Message your tutor"
            aria-label="Message your tutor"
            className="glass-inset w-full px-4 py-3 outline-none transition-all duration-200 ease-out focus:border-accent"
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-[var(--radius-control)] bg-accent-solid px-5 font-semibold text-white shadow-[0_8px_20px_-10px_var(--accent)] transition-all duration-200 ease-out disabled:opacity-40 disabled:shadow-none"
          >
            Send
          </button>
        </div>
        {/* Dictation sends as soon as the speaker stops, so a spoken question
            behaves like a spoken question rather than filling a box. */}
        <VoiceInput
          localeTag={dictationTagFor(TUTOR_VOICE)}
          label="Ask by voice"
          onInterim={setDraft}
          onTranscript={(text) => {
            setDraft(text);
            void send(text);
          }}
          className="px-1"
        />
      </form>
    </div>
  );
}
