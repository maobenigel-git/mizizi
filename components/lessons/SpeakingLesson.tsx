"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { LessonNotes } from "@/components/lessons/LessonNotes";
import { FlameIcon } from "@/components/shell/StreakFlame";
import { SpeakButton } from "@/components/voice/SpeakButton";
import { VoiceInput } from "@/components/voice/VoiceInput";
import type { PronunciationScore } from "@/lib/lessons/scoring";
import type { SpeakingLesson as Lesson } from "@/lib/lessons/speaking";
import type { LessonResult } from "@/lib/session/actions";

/*
 * Listen, repeat, advance.
 *
 * The character reads a phrase, the learner says it back, and the lesson moves
 * on once they are understood. Where the language has no voice or no dictation
 * (see lib/lessons/speaking), the same screen runs as read-and-check: the
 * phrase and its meaning, with the learner marking their own attempt. The
 * screen never pretends to score speech it cannot hear.
 */

const primaryButton =
  "w-full rounded-[var(--radius-control)] bg-accent-solid px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] transition-all duration-200 ease-out hover:opacity-90 disabled:opacity-40 disabled:shadow-none";

export function SpeakingLesson({
  lesson,
  languageName,
  character,
  noteCount,
  complete,
}: {
  lesson: Lesson;
  languageName: string;
  character?: string;
  noteCount: number;
  complete: () => Promise<LessonResult>;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState<PronunciationScore | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<LessonResult | null>(null);
  const [saving, startSaving] = useTransition();

  const phrase = lesson.phrases[index];
  const isLast = index === lesson.phrases.length - 1;
  const passed = score?.verdict === "correct";

  async function check(heard: string) {
    setChecking(true);
    try {
      const res = await fetch("/api/pronunciation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heard, target: phrase.text }),
      });
      if (res.ok) setScore(await res.json());
    } catch {
      // A failed check leaves the attempt unscored; the learner can retry.
    } finally {
      setChecking(false);
    }
  }

  function advance() {
    if (!isLast) {
      setIndex(index + 1);
      setScore(null);
      return;
    }
    startSaving(async () => setResult(await complete()));
  }

  if (result) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        <FlameIcon className="h-20 w-20 animate-pop text-gold" />
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            {result.streakIncremented ? `${result.streak}-day streak` : "Well done"}
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

  if (!phrase) {
    return (
      <div className="glass mx-auto w-full max-w-md p-8 text-center text-muted">
        <p>No {languageName} phrases are available to practise yet.</p>
        <Link href="/learn" className="mt-3 inline-block font-medium text-accent hover:underline">
          Back to your path
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link href="/learn" transitionTypes={["nav-back"]} aria-label="Leave lesson" className="press text-2xl leading-none text-muted hover:text-foreground">
          ×
        </Link>
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-inset-bg)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={lesson.phrases.length}
          aria-valuenow={index}
        >
          <div className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out" style={{ width: `${(index / lesson.phrases.length) * 100}%` }} />
        </div>
      </div>

      {/* The character delivers the line, speech-bubble style. */}
      <div key={index} className="flex animate-step-in items-end gap-3">
        {character && <CharacterImage src={character} name={`${languageName} character`} className="h-36 w-auto shrink-0 drop-shadow-xl" />}
        <div className="glass flex-1 space-y-3 p-4">
          <p className="text-2xl font-semibold tracking-tight">{phrase.text}</p>
          <p className="text-muted">{phrase.meaning}</p>
          <div className="flex flex-wrap items-center gap-2">
            {lesson.canSpeak ? (
              <SpeakButton text={phrase.text} languageId={lesson.languageId} localeTag={lesson.speechTag} label="Hear it" />
            ) : (
              <span className="text-xs text-muted">No {languageName} voice available — read it yourself.</span>
            )}
            {phrase.origin === "wiktionary" && (
              <span className="rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs text-muted">From Wiktionary</span>
            )}
            {phrase.origin === "google" && (
              <span className="rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs text-muted">Machine translation</span>
            )}
            {phrase.origin === "graph" && !phrase.verified && (
              <span className="rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs text-muted">Awaiting verification</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3">
        {lesson.canListen ? (
          <>
            <p className="text-sm font-medium">Now say it out loud.</p>
            <VoiceInput
              localeTag={lesson.localeTag}
              label={score ? "Try again" : "Hold and speak"}
              onTranscript={(heard) => void check(heard)}
            />
            {checking && <p className="text-sm text-muted">Checking…</p>}

            {score && (
              <div
                role="status"
                aria-live="polite"
                className={`animate-fade-in space-y-2 rounded-[var(--radius-control)] p-4 ${
                  passed ? "bg-forest/10 text-forest" : score.verdict === "close" ? "bg-gold/10 text-foreground" : "bg-red/10 text-red"
                }`}
              >
                <p className="font-semibold">
                  {passed ? "Correct" : score.verdict === "close" ? "Close" : "Not quite"} · {score.score}% match
                </p>
                <p className="text-sm text-foreground">
                  We heard: “{score.heard || "nothing"}”
                </p>
                {!passed && (
                  <p className="text-sm text-foreground">
                    Words to work on:{" "}
                    {score.words.filter((w) => !w.ok).map((w) => w.expected).join(", ") || "try speaking more clearly"}
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted">
              Scored on whether the recogniser understood your words, not on accent. Your audio stays on your device.
            </p>
          </>
        ) : (
          <div className="glass space-y-2 p-4 text-sm text-muted">
            <p className="font-medium text-foreground">Read-and-check</p>
            <p>
              No free speech recogniser covers {languageName}, so this lesson cannot score your pronunciation. Read the
              phrase aloud, then mark it yourself — we would rather leave it unscored than grade you with the wrong
              language&apos;s model.
            </p>
          </div>
        )}
      </div>

      {/* Context is the phrase itself, which is what makes the note legible later. */}
      <LessonNotes context={phrase.text} count={noteCount} />

      <button
        type="button"
        onClick={advance}
        disabled={saving || (lesson.canListen && !passed)}
        className={primaryButton}
      >
        {lesson.canListen && !passed ? "Say it to continue" : isLast ? "Finish" : "Continue"}
      </button>

      {lesson.canListen && !passed && score && (
        <button type="button" onClick={advance} className="press text-sm text-muted hover:text-foreground">
          Skip this one
        </button>
      )}
    </div>
  );
}
