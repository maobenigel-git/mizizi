"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LessonNotes } from "@/components/lessons/LessonNotes";
import { FlameIcon } from "@/components/shell/StreakFlame";
import type { Lesson } from "@/lib/lessons/orientation";
import { saveToNotebook, type LessonResult } from "@/lib/session/actions";

const primaryButton =
  "w-full rounded-xl bg-accent-solid px-6 py-3.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 disabled:opacity-40";

/*
 * A missed question comes back at the end of the lesson, and keeps coming back
 * until it is answered correctly — finishing a lesson means having got every
 * answer right once, not having clicked past them. Progress counts cleared
 * steps, so a retry never moves the bar backwards.
 */
export function LessonPlayer({
  lesson,
  noteCount,
  savedWordIds = [],
  complete,
  exitHref,
}: {
  lesson: Lesson;
  /** Shown on the notes button so the learner sees the list growing. */
  noteCount: number;
  /** Words already in the notebook, so their save button starts as saved. */
  savedWordIds?: string[];
  /** Server action that records the finished activity (lesson or review). */
  complete: () => Promise<LessonResult>;
  /** Where the × goes. */
  exitHref: string;
}) {
  const router = useRouter();
  // Step indices still to play; a missed question is appended again.
  const [queue, setQueue] = useState(() => lesson.steps.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [missed, setMissed] = useState<Set<number>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set(savedWordIds));
  const [result, setResult] = useState<LessonResult | null>(null);
  const [saving, startSaving] = useTransition();

  const index = queue[position];
  const step = lesson.steps[index];
  const answered = step.kind === "info" || selected !== null;
  const wrong = step.kind === "choice" && selected !== null && selected !== step.answer;
  const isRetry = queue.indexOf(index) < position;
  const isLast = position === queue.length - 1 && !wrong;
  // Distinct steps still to get through; the current one leaves once it is done right.
  const pending = new Set(queue.slice(position));
  if (answered && !wrong) pending.delete(index);
  const cleared = lesson.steps.length - pending.size;
  const questions = lesson.steps.filter((s) => s.kind === "choice").length;

  function choose(i: number) {
    setSelected(i);
    if (step.kind === "choice" && i !== step.answer) setMissed((m) => new Set(m).add(index));
  }

  function next() {
    if (wrong) setQueue([...queue, index]);
    if (!isLast) {
      setPosition(position + 1);
      setSelected(null);
      return;
    }
    startSaving(async () => setResult(await complete()));
  }

  function save(wordId: string) {
    setSaved((s) => new Set(s).add(wordId));
    void saveToNotebook(wordId, "lesson").then((ok) => {
      if (!ok) setSaved((s) => { const next = new Set(s); next.delete(wordId); return next; });
    });
  }

  if (result) {
    // Full-screen celebration is reserved for streak milestones (7/30/100/365).
    const frame = result.milestone
      ? "fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-6 bg-ocean-dark p-6 text-center text-white [&_p]:text-white/80"
      : "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center";
    return (
      <div className={frame}>
        <FlameIcon className="h-20 w-20 animate-pop text-gold" />
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {result.milestone
              ? `${result.milestone} days in a row!`
              : result.streakIncremented
                ? `${result.streak}-day streak`
                : "Well done"}
          </h1>
          <p className="text-muted">
            +{result.xpEarned} XP · {Math.min(result.lessonsToday, result.goal)} of {result.goal} lessons today
          </p>
          {questions > 0 && (
            <p className="text-muted">
              {questions - missed.size} of {questions} right first time
            </p>
          )}
        </div>
        <button type="button" onClick={() => router.push("/today")} className={`${primaryButton} max-w-md`}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href={exitHref} transitionTypes={["nav-back"]} aria-label="Leave lesson" className="text-2xl leading-none text-muted hover:text-foreground">
            ×
          </Link>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={cleared}>
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out"
            style={{ width: `${(cleared / lesson.steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div key={position} className="flex flex-1 animate-step-in flex-col gap-5">
        {step.kind === "info" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
            <p className="text-lg leading-relaxed">{step.body}</p>
          </>
        ) : (
          <>
            {isRetry && (
              <p className="w-fit rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs font-medium text-muted">
                One more try
              </p>
            )}
            <h1 className="text-xl font-semibold tracking-tight">{step.prompt}</h1>
            <div className="space-y-3">
              {step.options.map((option, i) => {
                const isAnswer = i === step.answer;
                const state =
                  selected === null
                    ? "border-border bg-surface hover:border-accent"
                    : isAnswer
                      ? `border-forest bg-forest/10 font-medium ${selected === i ? "animate-pop" : "animate-flash"}`
                      : selected === i
                        ? "border-red bg-red/10 text-muted line-through"
                        : "border-border bg-surface opacity-50";
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={selected !== null}
                    onClick={() => choose(i)}
                    className={`w-full rounded-xl border-2 px-4 py-3.5 text-left transition-colors duration-150 ease-out ${state}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
            {selected !== null && (
              <p className="animate-fade-in text-sm text-muted" aria-live="polite">
                <span className={`font-medium ${selected === step.answer ? "text-forest" : "text-red"}`}>
                  {selected === step.answer ? "Correct. " : `The answer is ${step.options[step.answer]}. `}
                </span>
                {step.explain}
                {wrong && " It will come back at the end."}
              </p>
            )}
            {selected !== null && step.wordId && (
              <button
                type="button"
                onClick={() => save(step.wordId!)}
                disabled={saved.has(step.wordId)}
                className="press w-fit rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors duration-200 ease-out hover:bg-accent/10 disabled:bg-accent-solid disabled:text-white"
              >
                {saved.has(step.wordId) ? "Saved to notebook" : "Save to notebook"}
              </button>
            )}
          </>
        )}
      </div>

      <LessonNotes context={step.kind === "info" ? step.title : step.prompt} count={noteCount} />

      <button type="button" onClick={next} disabled={!answered || saving} className={primaryButton}>
        {isLast ? "Finish" : "Continue"}
      </button>
    </div>
  );
}
