"use client";

export default function ErrorScreen({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="text-muted">Your progress is safe. Try that again.</p>
      <button type="button" onClick={reset} className="rounded-xl bg-accent-solid px-6 py-3 font-semibold text-white">
        Try again
      </button>
    </div>
  );
}
