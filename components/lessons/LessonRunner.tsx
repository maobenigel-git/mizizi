"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { LessonNotes } from "@/components/lessons/LessonNotes";
import { FlameIcon } from "@/components/shell/StreakFlame";
import { answerExercise, completeLevel, startAttempt, type CompletionResult } from "@/lib/lessons/actions";
import type { ClientExercise, ExerciseKind } from "@/lib/lessons/levels";
import { saveToNotebook } from "@/lib/session/actions";
import { PronunciationPractice, type SpeechSupport } from "./PronunciationPractice";
import { useModelVoice } from "./useModelVoice";

/*
 * One level, start to finish:
 *
 *   intro → exercises (a missed question returns at the end) → completion
 *
 * Nothing here decides whether an answer is right or whether the level is
 * done. Answers go to answerExercise, spoken attempts to the pronunciation
 * endpoint, and completeLevel checks the level's requirements on the server.
 * The browser never even has the answer key.
 */

export type RunnerLevel = {
  number: number;
  title: string;
  summary: string;
  kinds: ExerciseKind[];
  exercises: ClientExercise[];
};

type Feedback = { selected: number; correct: boolean; answer: number; explain?: string };

const primaryButton =
  "press w-full rounded-[var(--radius-control)] bg-accent-solid px-6 py-3.5 font-semibold text-white shadow-[0_10px_24px_-10px_var(--accent)] transition-all duration-200 ease-out hover:opacity-90 disabled:opacity-40 disabled:shadow-none";

const kindLabels: Record<ExerciseKind, string> = {
  info: "A short introduction",
  choice: "Words and meanings",
  listening: "Listening",
  pronunciation: "Speaking practice",
  final_check: "A final check",
};

export function LessonRunner({
  level,
  total,
  languageId,
  languageName,
  character,
  speech,
  noteCount,
  savedWordIds,
}: {
  level: RunnerLevel;
  total: number;
  languageId: string;
  languageName: string;
  character?: string;
  speech: SpeechSupport;
  noteCount: number;
  savedWordIds: string[];
}) {
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [queue, setQueue] = useState(() => level.exercises.map((_, i) => i));
  const [position, setPosition] = useState(0);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [spoken, setSpoken] = useState<Set<string>>(() => new Set());
  const [saved, setSaved] = useState<Set<string>>(() => new Set(savedWordIds));
  const [outcome, setOutcome] = useState<CompletionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();
  const voice = useModelVoice({ languageId, canSpeak: speech.canSpeak, speechTag: speech.speechTag });

  const index = queue[position];
  const exercise = level.exercises[index];
  const isChoice = exercise?.kind === "choice" || exercise?.kind === "final_check" || exercise?.kind === "listening";
  const wrong = isChoice && feedback !== null && !feedback.correct;
  const done =
    exercise?.kind === "info" ||
    (isChoice && feedback !== null) ||
    (exercise?.kind === "pronunciation" && spoken.has(exercise.id));
  const isLast = position === queue.length - 1 && !wrong;
  const isRetry = queue.indexOf(index) < position;

  // Distinct exercises still to clear; the current one leaves once it's done right.
  const pending = new Set(queue.slice(position));
  if (done && !wrong) pending.delete(index);
  const cleared = level.exercises.length - pending.size;

  const markSpoken = useCallback((id: string) => setSpoken((s) => (s.has(id) ? s : new Set(s).add(id))), []);

  function begin() {
    setError(null);
    startBusy(async () => {
      const started = await startAttempt(level.number);
      if ("error" in started) setError(started.error);
      else setAttemptId(started.attemptId);
    });
  }

  function restart() {
    setQueue(level.exercises.map((_, i) => i));
    setPosition(0);
    setFeedback(null);
    setSpoken(new Set());
    setOutcome(null);
    begin();
  }

  function choose(choice: number) {
    if (!attemptId || feedback || !exercise) return;
    setError(null);
    startBusy(async () => {
      const result = await answerExercise(attemptId, exercise.id, choice);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setFeedback({ selected: choice, correct: result.correct, answer: result.answer, explain: result.explain });
    });
  }

  function next() {
    voice.stop();
    if (wrong) setQueue([...queue, index]);
    if (!isLast) {
      setPosition(position + 1);
      setFeedback(null);
      return;
    }
    startBusy(async () => {
      const result = await completeLevel(attemptId!);
      setOutcome(result);
    });
  }

  function save(wordId: string) {
    setSaved((s) => new Set(s).add(wordId));
    void saveToNotebook(wordId, "lesson").then((ok) => {
      if (!ok) setSaved((s) => { const copy = new Set(s); copy.delete(wordId); return copy; });
    });
  }

  /* ── intro ── */
  if (!attemptId && !outcome) {
    const speaking = level.kinds.includes("pronunciation");
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6">
        <Link href="/learn" transitionTypes={["nav-back"]} aria-label="Back to your path" className="press w-fit text-2xl leading-none text-muted hover:text-foreground">
          ×
        </Link>
        <div className="flex flex-1 flex-col justify-center gap-5">
          {character && <CharacterImage src={character} name={`${languageName} character`} className="h-36 self-start" />}
          <div className="space-y-2">
            <p className="text-sm font-medium text-accent">
              Level {level.number} of {total} · {languageName}
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">{level.title}</h1>
            <p className="text-muted">{level.summary}</p>
          </div>
          <ul className="glass divide-y divide-[var(--glass-edge)] text-sm">
            {level.kinds.map((kind) => (
              <li key={kind} className="flex items-center gap-3 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
                {kindLabels[kind]}
              </li>
            ))}
          </ul>
          {speaking && speech.recognizer.kind === "none" && (
            <p className="text-sm text-muted">
              No speech checker covers {languageName} yet, so the speaking part is read-aloud practice and isn&apos;t scored.
            </p>
          )}
          {speaking && speech.recognizer.kind !== "none" && (
            <p className="text-sm text-muted">You&apos;ll be asked to speak, so find somewhere you can use your microphone.</p>
          )}
        </div>
        {error && <p className="text-sm text-red">{error}</p>}
        <button type="button" onClick={begin} disabled={busy} className={primaryButton}>
          {busy ? "Starting…" : "Start"}
        </button>
      </div>
    );
  }

  /* ── finished ── */
  if (outcome?.ok) return <LevelComplete outcome={outcome} title={level.title} />;
  if (outcome && !outcome.ok) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">So close</h1>
          <p className="text-muted">{outcome.message}</p>
        </div>
        <button type="button" onClick={restart} disabled={busy} className={`${primaryButton} max-w-md`}>
          Try the level again
        </button>
        <Link href="/learn" className="text-sm text-muted hover:text-foreground">
          Back to your path
        </Link>
      </div>
    );
  }

  /* ── exercises ── */
  const wordId = exercise && "wordId" in exercise ? exercise.wordId : undefined;
  const context =
    exercise.kind === "info" ? exercise.title : exercise.kind === "pronunciation" || exercise.kind === "listening" ? exercise.text : exercise.prompt;

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/learn" transitionTypes={["nav-back"]} aria-label="Leave lesson" className="press text-2xl leading-none text-muted hover:text-foreground">
          ×
        </Link>
        <div
          className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--glass-inset-bg)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={level.exercises.length}
          aria-valuenow={cleared}
        >
          <div className="h-full rounded-full bg-forest transition-[width] duration-300 ease-out" style={{ width: `${(cleared / level.exercises.length) * 100}%` }} />
        </div>
      </div>

      <div key={position} className="flex flex-1 animate-step-in flex-col gap-5">
        {isRetry && (
          <p className="w-fit rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs font-medium text-muted">One more try</p>
        )}

        {exercise.kind === "info" && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{exercise.title}</h1>
            <p className="text-lg leading-relaxed">{exercise.body}</p>
          </>
        )}

        {exercise.kind === "pronunciation" && (
          <PronunciationPractice
            exercise={exercise}
            attemptId={attemptId!}
            languageId={languageId}
            languageName={languageName}
            speech={speech}
            onSatisfied={() => markSpoken(exercise.id)}
          />
        )}

        {isChoice && (
          <>
            {exercise.kind === "listening" ? (
              <div className="glass flex flex-col items-center gap-3 p-6 text-center">
                <p className="text-sm font-medium text-muted">What does this mean?</p>
                <button
                  type="button"
                  onClick={() => (voice.playing ? voice.stop() : void voice.play(exercise.text, exercise.audioUrl))}
                  aria-label="Play the word"
                  className="press grid h-16 w-16 place-items-center rounded-full bg-accent-solid text-white shadow-[0_10px_24px_-10px_var(--accent)] transition-all duration-200 ease-out"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-7 w-7">
                    {voice.playing ? <path d="M9 6v12M15 6v12" /> : <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7" />}
                  </svg>
                </button>
                <p className="text-xs text-muted">{exercise.audioUrl ? "Native speaker" : "Machine voice, not a native speaker"}</p>
                {feedback && <p className="animate-fade-in text-2xl font-semibold">{exercise.text}</p>}
              </div>
            ) : (
              <h1 className="text-xl font-semibold tracking-tight">
                {exercise.kind === "final_check" && <span className="mb-1 block text-sm font-medium text-accent">Final check</span>}
                {exercise.prompt}
              </h1>
            )}

            <div className="space-y-3">
              {exercise.options.map((option, i) => {
                const state =
                  feedback === null
                    ? "border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] hover:border-accent"
                    : i === feedback.answer
                      ? `border-forest bg-forest/10 font-medium ${feedback.selected === i ? "animate-pop" : "animate-flash"}`
                      : feedback.selected === i
                        ? "border-red bg-red/10 text-muted line-through"
                        : "border-[var(--glass-edge)] opacity-50";
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={feedback !== null || busy}
                    onClick={() => choose(i)}
                    className={`press w-full rounded-[var(--radius-control)] border-2 px-4 py-3.5 text-left transition-colors duration-150 ease-out ${state}`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>

            {feedback && (
              <p className="animate-fade-in text-sm text-muted" aria-live="polite">
                <span className={`font-medium ${feedback.correct ? "text-forest" : "text-red"}`}>
                  {feedback.correct ? "Correct. " : `The answer is ${exercise.options[feedback.answer]}. `}
                </span>
                {feedback.explain}
                {!feedback.correct && " It will come back at the end."}
              </p>
            )}
            {feedback && wordId && (
              <button
                type="button"
                onClick={() => save(wordId)}
                disabled={saved.has(wordId)}
                className="press w-fit rounded-lg border border-accent px-4 py-2 text-sm font-medium text-accent transition-colors duration-200 ease-out hover:bg-accent/10 disabled:bg-accent-solid disabled:text-white"
              >
                {saved.has(wordId) ? "Saved to notebook" : "Save to notebook"}
              </button>
            )}
          </>
        )}
      </div>

      {error && <p className="text-sm text-red">{error}</p>}
      <LessonNotes context={context} count={noteCount} />

      <button type="button" onClick={next} disabled={!done || busy} className={primaryButton}>
        {busy && isLast ? "Checking…" : exercise.kind === "pronunciation" && !done ? "Say it to continue" : isLast ? "Finish" : "Continue"}
      </button>
    </div>
  );
}

function LevelComplete({ outcome, title }: { outcome: Extract<CompletionResult, { ok: true }>; title: string }) {
  const router = useRouter();
  const { activity } = outcome;
  const unlocked = outcome.firstCompletion && outcome.nextLevel !== null;
  // The path animates the unlock when it is told which level just finished.
  const back = outcome.firstCompletion ? `/learn?completed=${outcome.level}` : "/learn";

  return (
    <div
      className={
        activity.milestone
          ? "fixed inset-0 z-50 flex animate-fade-in flex-col items-center justify-center gap-6 bg-ocean-dark p-6 text-center text-white [&_p]:text-white/80"
          : "mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 text-center"
      }
    >
      {activity.milestone ? (
        <FlameIcon className="h-20 w-20 animate-pop text-gold" />
      ) : (
        <span className="grid h-20 w-20 animate-pop place-items-center rounded-full bg-forest text-white shadow-[0_14px_32px_-14px_var(--forest)]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-10 w-10">
            <path d="m5 12.5 4.5 4.5L19 7.5" />
          </svg>
        </span>
      )}
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {activity.milestone ? `${activity.milestone} days in a row!` : `Level ${outcome.level} complete`}
        </h1>
        <p className="text-muted">{title}</p>
      </div>
      <dl className="grid w-full max-w-xs grid-cols-3 gap-2 text-center">
        <Stat label="Score" value={`${outcome.score}%`} />
        <Stat label="XP" value={`+${activity.xpEarned}`} />
        <Stat label="Streak" value={`${activity.streak}d`} />
      </dl>
      <p className="text-sm text-muted">
        {Math.min(activity.lessonsToday, activity.goal)} of {activity.goal} lessons today
        {activity.streakIncremented && !activity.milestone ? " · streak extended" : ""}
      </p>
      {unlocked && (
        <p className="animate-unlock rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent">
          Level {outcome.nextLevel} unlocked
        </p>
      )}
      <button type="button" onClick={() => router.push(back)} className={`${primaryButton} max-w-md`}>
        Continue
      </button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass !rounded-xl px-2 py-3">
      <dd className="text-xl font-semibold">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
