"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { saveNote, type NoteResult } from "@/lib/session/actions";
import { NOTE_MAX_LENGTH } from "@/lib/session/types";

/*
 * Note-taking inside a lesson.
 *
 * A drawer rather than a panel on the page: taking a note is an interruption
 * of the lesson, and it should close and get out of the way again. It stays
 * mounted across steps so a half-written note survives moving on.
 *
 * `context` is whatever the learner was looking at when they opened it, which
 * is what makes the note readable later in the Notebook.
 */

const initial: NoteResult = { ok: true };

export function LessonNotes({ context, count }: { context?: string; count: number }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // Stamped by the action, cleared by the timer below — never set from an
  // effect body, which would cascade a render on every save.
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const field = useRef<HTMLTextAreaElement>(null);

  const [result, formAction, pending] = useActionState(async (_prev: NoteResult, formData: FormData) => {
    const outcome = await saveNote(formData);
    if (outcome.ok) {
      setText("");
      setSavedAt(Date.now());
    }
    return outcome;
  }, initial);

  // Fade the confirmation rather than leaving it up.
  useEffect(() => {
    if (savedAt === null) return;
    const timer = setTimeout(() => setSavedAt(null), 2500);
    return () => clearTimeout(timer);
  }, [savedAt]);

  useEffect(() => {
    if (open) field.current?.focus();
  }, [open]);

  const remaining = NOTE_MAX_LENGTH - text.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="lesson-notes"
        className="press inline-flex items-center gap-2 self-start rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-sm text-[var(--accent-on-glass)] transition-all duration-200 ease-out hover:border-accent"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
          <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
        {open ? "Close notes" : "Take a note"}
        {count > 0 && (
          <span className="rounded-full bg-accent-solid px-1.5 text-[11px] font-medium text-white">{count}</span>
        )}
      </button>

      {open && (
        <div id="lesson-notes" className="glass animate-fade-in space-y-2 p-4">
          <form action={formAction} className="space-y-2">
            {context && <input type="hidden" name="context" value={context} />}
            <label className="block">
              <span className="sr-only">Your note</span>
              <textarea
                ref={field}
                name="text"
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, NOTE_MAX_LENGTH))}
                rows={3}
                maxLength={NOTE_MAX_LENGTH}
                placeholder={context ? `Note about “${context}”…` : "What do you want to remember?"}
                className="glass-inset w-full resize-none px-3 py-2 outline-none transition-all duration-200 ease-out focus:border-accent"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className={`text-xs ${remaining <= 20 ? "text-red" : "text-muted"}`}>{remaining} left</span>
              <button
                type="submit"
                disabled={pending || !text.trim()}
                className="press rounded-[var(--radius-control)] bg-accent-solid px-4 py-2 text-sm font-semibold text-white transition-all duration-200 ease-out disabled:opacity-40"
              >
                {pending ? "Saving…" : "Save note"}
              </button>
            </div>
          </form>

          <p role="status" aria-live="polite" className="min-h-4 text-xs">
            {!result.ok ? (
              <span className="text-red">{result.message}</span>
            ) : savedAt !== null ? (
              <span className="text-forest">Saved to your notebook.</span>
            ) : null}
          </p>
        </div>
      )}
    </>
  );
}
