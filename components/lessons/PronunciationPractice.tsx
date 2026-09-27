"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { VoiceInput } from "@/components/voice/VoiceInput";
import { assessTranscript, skipSpeaking } from "@/lib/lessons/actions";
import type { PronunciationExercise } from "@/lib/lessons/levels";
import type { PronunciationAssessment, WordAssessment } from "@/lib/lessons/scoring";
import { useModelVoice } from "./useModelVoice";
import { useRecorder, type RecorderError } from "./useRecorder";

/*
 * Say it, get feedback, try again.
 *
 * Three ways it can run, decided on the server (lib/speech/recognition):
 *
 *   server   the recording goes to /api/pronunciation/assess (Google), and
 *            comes back word by word with confidence
 *   browser  Chrome/Edge's recogniser hears it; the transcript is scored
 *   none     no recogniser covers the language: read-aloud practice, unscored
 *
 * After any attempt that isn't excellent, the correct pronunciation plays
 * (native recording first, labelled machine voice otherwise), so the learner
 * hears the target straight after hearing where they slipped.
 */

export type SpeechSupport = {
  recognizer: { kind: "server"; provider: string } | { kind: "browser"; localeTag: string } | { kind: "none" };
  canSpeak: boolean;
  speechTag?: string;
  pass: number;
  attemptsToSkip: number;
};

type Phase = "ready" | "checking" | "result";

/** Recogniser failures the assess route records as (unscored) tries. */
const RECORDED_FAILURES = ["busy", "unavailable", "not_configured"];

const recorderMessages: Record<RecorderError, string> = {
  denied: "Microphone access is blocked. Allow it for this site in your browser's settings, then try again.",
  no_mic: "No microphone was found. Plug one in, or use a device that has one.",
  unsupported: "This browser can't record audio. Try Chrome, Edge, Firefox or Safari.",
  failed: "The microphone couldn't start. Try again.",
};

const verdictCopy = {
  excellent: { title: "Excellent!", line: "Every word came through clearly." },
  almost: { title: "Almost there", line: "Nearly all of it came through. Listen once more, then try again." },
  practice: { title: "Needs practice", line: "Listen to it, then try again slowly, word by word." },
} as const;

const wordStyles: Record<WordAssessment["status"], string> = {
  good: "text-forest",
  unclear: "text-accent underline decoration-dotted decoration-2 underline-offset-4",
  missed: "text-red underline decoration-2 underline-offset-4",
};

export function PronunciationPractice({
  exercise,
  attemptId,
  languageId,
  languageName,
  speech,
  onSatisfied,
}: {
  exercise: PronunciationExercise;
  attemptId: string;
  languageId: string;
  languageName: string;
  speech: SpeechSupport;
  /** Called once the exercise no longer blocks the lesson. */
  onSatisfied: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("ready");
  const [assessment, setAssessment] = useState<PronunciationAssessment | null>(null);
  const [best, setBest] = useState(0);
  const [tries, setTries] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [ownRecording, setOwnRecording] = useState<string | null>(null);
  const [skipped, setSkipped] = useState(false);
  const voice = useModelVoice({ languageId, canSpeak: speech.canSpeak, speechTag: speech.speechTag });
  const hasModel = Boolean(exercise.audioUrl) || speech.canSpeak;
  const ownAudio = useRef<HTMLAudioElement | null>(null);

  const satisfied =
    speech.recognizer.kind === "none" || skipped || best >= speech.pass || tries >= speech.attemptsToSkip;
  useEffect(() => {
    if (satisfied) onSatisfied();
  }, [satisfied, onSatisfied]);

  // Free the learner's own recording when it is replaced or the step ends.
  useEffect(() => () => void (ownRecording && URL.revokeObjectURL(ownRecording)), [ownRecording]);

  const showResult = useCallback(
    (result: PronunciationAssessment) => {
      setAssessment(result);
      setBest((b) => Math.max(b, result.score));
      setPhase("result");
      // Hear the target right after seeing what slipped.
      if (result.verdict !== "excellent" && hasModel) {
        setTimeout(() => void voice.play(exercise.text, exercise.audioUrl), 500);
      }
    },
    [exercise.audioUrl, exercise.text, hasModel, voice],
  );

  const sendRecording = useCallback(
    async (wav: Blob | null) => {
      if (!wav || wav.size < 8_000) {
        setMessage("That was too short to hear. Hold the button a moment longer.");
        setPhase(assessment ? "result" : "ready");
        return;
      }
      setOwnRecording(URL.createObjectURL(wav));
      setPhase("checking");
      setMessage(null);
      const form = new FormData();
      form.set("audio", wav, "attempt.wav");
      form.set("attemptId", attemptId);
      form.set("exerciseId", exercise.id);
      try {
        const res = await fetch("/api/pronunciation/assess", { method: "POST", body: form });
        const body = await res.json().catch(() => ({}));
        // Count exactly what the server recorded as a try: a scored attempt, or a
        // recogniser failure (so an outage can't trap the learner here) — not
        // bad input or our own rate limit.
        if (res.ok || RECORDED_FAILURES.includes(body.error)) setTries((t) => t + 1);
        if (!res.ok) {
          setMessage(body.message ?? "Couldn't check that one. Try again.");
          setPhase(assessment ? "result" : "ready");
          return;
        }
        showResult(body.assessment as PronunciationAssessment);
      } catch {
        setMessage("You seem to be offline. Check your connection and try again.");
        setPhase(assessment ? "result" : "ready");
      }
    },
    [assessment, attemptId, exercise.id, showResult],
  );

  const recorder = useRecorder((wav) => void sendRecording(wav));

  async function checkTranscript(heard: string) {
    setPhase("checking");
    setMessage(null);
    const outcome = await assessTranscript(attemptId, exercise.id, heard);
    setTries((t) => t + 1);
    if (!outcome.ok) {
      setMessage(outcome.message);
      setPhase(assessment ? "result" : "ready");
      return;
    }
    showResult(outcome.assessment);
  }

  async function skip() {
    voice.stop();
    recorder.stop();
    const outcome = await skipSpeaking(attemptId, exercise.id);
    if (outcome.ok) setSkipped(true);
    else setMessage("Couldn't skip that one. Try again.");
  }

  function toggleRecording() {
    voice.stop();
    if (recorder.state === "recording") recorder.stop();
    else void recorder.start();
  }

  const recording = recorder.state === "recording";
  const checking = phase === "checking";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <section className="glass space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-muted">Say this in {languageName}</p>
          {exercise.origin === "wiktionary" && <Tag>From Wiktionary</Tag>}
          {exercise.origin === "google" && <Tag>Machine translation</Tag>}
          {exercise.origin !== "wiktionary" && exercise.origin !== "google" && !exercise.verified && <Tag>Awaiting verification</Tag>}
        </div>

        {/* After an attempt, each word carries its result. */}
        <p className="text-3xl font-semibold leading-snug tracking-tight">
          {assessment
            ? exercise.text.split(/\s+/).map((raw, i) => {
                const word = assessment.words[i];
                return (
                  <span key={i}>
                    <button
                      type="button"
                      disabled={!speech.canSpeak}
                      onClick={() => void voice.play(raw)}
                      className={`rounded transition-colors duration-200 ease-out ${word ? wordStyles[word.status] : ""} ${speech.canSpeak ? "hover:bg-[var(--glass-inset-bg)]" : "cursor-default"}`}
                      aria-label={word ? `${raw}: ${word.status === "good" ? "clear" : word.status === "unclear" ? "not clear" : "missed"}` : raw}
                    >
                      {raw}
                    </button>{" "}
                  </span>
                );
              })
            : exercise.text}
        </p>
        <p className="text-muted">{exercise.meaning}</p>

        <div className="flex flex-wrap items-center gap-2">
          {hasModel ? (
            <button
              type="button"
              onClick={() => (voice.playing ? voice.stop() : void voice.play(exercise.text, exercise.audioUrl))}
              className="press inline-flex items-center gap-1.5 rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-sm text-[var(--accent-on-glass)] transition-all duration-200 ease-out hover:border-accent"
            >
              <SpeakerIcon playing={voice.playing} />
              {voice.playing ? "Playing…" : "Hear it"}
            </button>
          ) : (
            <span className="text-xs text-muted">No recording of this yet — read it as written.</span>
          )}
          {hasModel && (
            <span className="text-xs text-muted">
              {exercise.audioUrl ? "Native speaker" : "Machine voice, not a native speaker"}
            </span>
          )}
        </div>
      </section>

      {speech.recognizer.kind === "none" ? (
        <div className="glass space-y-2 p-4 text-sm text-muted">
          <p className="font-medium text-foreground">Read it aloud</p>
          <p>
            No speech checker covers {languageName} yet, so this one isn&apos;t scored. Say it out loud a couple of times,
            then continue — we&apos;d rather not grade you with another language&apos;s model.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          {speech.recognizer.kind === "server" ? (
            <>
              <button
                type="button"
                onClick={toggleRecording}
                disabled={checking || recorder.state === "starting"}
                aria-pressed={recording}
                aria-label={recording ? "Stop recording" : "Start recording"}
                className="press relative grid h-20 w-20 place-items-center rounded-full bg-accent-solid text-white shadow-[0_12px_28px_-12px_var(--accent)] transition-all duration-200 ease-out disabled:opacity-50"
              >
                {/* The ring follows the learner's voice, so they can see they're being heard. */}
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border-2 border-accent transition-transform duration-100 ease-out"
                  style={{ transform: `scale(${1 + (recording ? recorder.level * 0.35 : 0)})`, opacity: recording ? 0.6 : 0 }}
                />
                {recording ? <StopIcon /> : <MicIcon />}
              </button>
              <p className="text-sm text-muted" aria-live="polite">
                {checking
                  ? "Listening back…"
                  : recording
                    ? `Listening… tap to stop · ${Math.floor(recorder.elapsed)}s`
                    : assessment
                      ? "Tap to try again"
                      : "Tap and say it"}
              </p>
            </>
          ) : (
            <>
              <VoiceInput
                localeTag={speech.recognizer.localeTag}
                label={assessment ? "Try again" : "Hold and speak"}
                onTranscript={(heard) => void checkTranscript(heard)}
              />
              {checking && <p className="text-sm text-muted">Checking…</p>}
            </>
          )}
          {recorder.error && <p className="text-center text-sm text-red">{recorderMessages[recorder.error]}</p>}
          {message && <p className="text-center text-sm text-red">{message}</p>}
          {!satisfied && (
            <button type="button" onClick={() => void skip()} className="press text-sm text-muted underline-offset-4 hover:text-foreground hover:underline">
              Can&apos;t speak right now
            </button>
          )}
          {skipped && <p className="text-center text-sm text-muted">Skipped — this one won&apos;t count towards your score.</p>}
        </div>
      )}

      {assessment && phase === "result" && (
        <section
          role="status"
          aria-live="polite"
          className={`animate-fade-in space-y-3 rounded-[var(--radius-panel)] p-4 ${
            assessment.verdict === "excellent" ? "bg-forest/10" : assessment.verdict === "almost" ? "bg-accent/10" : "bg-[var(--glass-inset-bg)]"
          }`}
        >
          <div className="flex items-baseline justify-between gap-3">
            <p
              className={`text-lg font-semibold ${
                assessment.verdict === "excellent" ? "text-forest" : assessment.verdict === "almost" ? "text-accent" : "text-foreground"
              }`}
            >
              {verdictCopy[assessment.verdict].title}
            </p>
            <p className="text-sm text-muted">{assessment.score}% clear</p>
          </div>
          <p className="text-sm">{verdictCopy[assessment.verdict].line}</p>

          {assessment.words.some((w) => w.status !== "good") && (
            <p className="text-sm">
              <span className="text-muted">Work on: </span>
              {assessment.words
                .filter((w) => w.status !== "good")
                .map((w) => (w.heard ? `${w.expected} (sounded like “${w.heard}”)` : w.expected))
                .join(", ")}
            </p>
          )}
          <p className="text-sm text-muted">We heard: “{assessment.transcript || "nothing clear"}”</p>

          <div className="flex flex-wrap gap-2">
            {ownRecording && (
              <button
                type="button"
                onClick={() => {
                  ownAudio.current?.pause();
                  ownAudio.current = new Audio(ownRecording);
                  void ownAudio.current.play();
                }}
                className="press rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-sm transition-all duration-200 ease-out hover:border-accent"
              >
                Hear yourself
              </button>
            )}
            {hasModel && assessment.verdict !== "excellent" && (
              <button
                type="button"
                onClick={() => void voice.play(exercise.text, exercise.audioUrl)}
                className="press rounded-full border border-[var(--glass-edge)] bg-[var(--glass-inset-bg)] px-3 py-1.5 text-sm transition-all duration-200 ease-out hover:border-accent"
              >
                Hear it correctly
              </button>
            )}
          </div>
          <p className="text-xs text-muted">
            Checked word by word by {speech.recognizer.kind === "server" ? "a speech recogniser" : "your browser's speech recogniser"}. It
            can tell which words came through clearly — not which individual sounds — and it doesn&apos;t grade your accent.
          </p>
        </section>
      )}

      {!satisfied && tries > 0 && (
        <p className="text-center text-xs text-muted">
          {speech.attemptsToSkip - tries} more {speech.attemptsToSkip - tries === 1 ? "try" : "tries"} and you can move on either way.
        </p>
      )}
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[var(--glass-inset-bg)] px-2.5 py-0.5 text-xs text-muted">{children}</span>;
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="relative h-8 w-8">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="relative h-7 w-7">
      <rect x="7" y="7" width="10" height="10" rx="2" />
    </svg>
  );
}

function SpeakerIcon({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-4 w-4">
      {playing ? <path d="M9 6v12M15 6v12" /> : <path d="M11 5 6 9H3v6h3l5 4V5Zm4.5 3.5a5 5 0 0 1 0 7" />}
    </svg>
  );
}
