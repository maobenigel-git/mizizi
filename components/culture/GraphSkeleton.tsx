/** Skeleton, not a spinner, for knowledge-graph content (docs/spec.md §2.6). */
export function GraphSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-busy="true" aria-label="Loading">
      <div className="h-9 w-64 rounded-lg bg-border" />
      <div className="h-4 w-full max-w-xl rounded bg-border" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 9 }, (_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-border/70" />
        ))}
      </div>
    </div>
  );
}
