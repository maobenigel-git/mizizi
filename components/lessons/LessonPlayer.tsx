"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FlameIcon } from "@/components/shell/StreakFlame";
import type { Lesson } from "@/lib/lessons/orientation";
import type { LessonResult } from "@/lib/session/actions";

const primaryButton =
  "w-full rounded-xl bg-accent-solid px-6 py-3.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 disabled:opacity-40";

export function LessonPlayer({
  lesson,
  complete,
  exitHref,
}: {
  lesson: Lesson;
  /** Server action that records the finished activity (lesson or review). */
  complete: () => Promise<LessonResult>;
  /** Where the × goes. */
  exitHref: string;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [saving, startSaving] = useTransition();

  const step = lesson.steps[index];
  const isLast = index === lesson.steps.length - 1;
  const answered = step.kind === "info" || selected !== null;

  function next() {
    if (!isLast) {
      setIndex(index + 1);
      setSelected(null);
      return;
    }
    startSaving(async () => setResult(await complete()));
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
        </div>
        <button type="button" onClick={() => router.push("/today")} className={`${primaryButton} max-w-md`}>
          Continue
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8">
      <div className="flex items-center gap-3">
        <Link href={exitHref} transitionTypes={["nav-back"]} aria-label="Leave lesson" className="text-2xl leading-none text-muted hover:text-foreground">
            ×
          </Link>
        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={lesson.steps.length} aria-valuenow={index}>
          <div
            className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out"
            style={{ width: `${(index / lesson.steps.length) * 100}%` }}
          />
        </div>
      </div>

      <div key={index} className="flex flex-1 animate-step-in flex-col gap-5">
        {step.kind === "info" ? (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
            <p className="text-lg leading-relaxed">{step.body}</p>
          </>
        ) : (
          <>
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
                    onClick={() => setSelected(i)}
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
              </p>
            )}
          </>
        )}
      </div>

      <button type="button" onClick={next} disabled={!answered || saving} className={primaryButton}>
        {isLast ? "Finish" : "Continue"}
      </button>
    </div>
  );
}
