"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PathLevel } from "@/lib/lessons/progress";

/*
 * The learning path: levels as nodes on a winding trail that grows like a
 * root — mizizi — rather than a board game.
 *
 *   - The trail is one SVG path of smooth cubic curves between nodes, with a
 *     few short rootlets branching off it. Positions are deterministic per
 *     level, so the path never reshuffles between visits.
 *   - The walked part of the trail (up to the current level) is drawn over it
 *     in the success colour.
 *   - The current level breathes, slowly. Nothing else moves unless something
 *     happened: after a completion (?completed=N) the trail draws on to the
 *     next node and that node opens.
 *   - Only the levels near the screen are loaded and rendered; more arrive
 *     from /api/courses/{language}/path as the learner scrolls. A course of a
 *     thousand levels is a tall page, not a thousand nodes.
 *
 * All motion respects prefers-reduced-motion (app/globals.css).
 */

const ROW = 112;
const NODE = 60;
const PAD = 16;
const PAGE = 40;

function hash(n: number): number {
  let h = n * 2654435761;
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/**
 * Horizontal position, 0–100 (% of the width): two slow waves of different
 * periods, so the trail never settles into a regular zigzag, plus a little
 * jitter. Level 1 starts on the centre line; the amplitudes keep every node
 * inside 22–78% without clamping, which would flatten runs of levels.
 */
function xOf(n: number): number {
  const t = n - 1;
  const wave = Math.sin(t * 0.9) * 20 + Math.sin(t * 0.37) * 6;
  const jitter = n === 1 ? 0 : ((hash(n) % 1000) / 1000 - 0.5) * 4;
  return Math.min(78, Math.max(22, 50 + wave + jitter));
}
const yOf = (n: number) => PAD + (n - 1) * ROW + ROW / 2;

/** A smooth S-curve from level a's node to level b's, in pixels. */
function segment(a: number, b: number, width: number): string {
  const [x1, y1, x2, y2] = [(xOf(a) / 100) * width, yOf(a), (xOf(b) / 100) * width, yOf(b)];
  const pull = ROW * 0.55;
  return `C ${x1} ${y1 + pull}, ${x2} ${y2 - pull}, ${x2} ${y2}`;
}

function trail(from: number, to: number, width: number): string {
  if (to <= from) return "";
  let d = `M ${(xOf(from) / 100) * width} ${yOf(from)}`;
  for (let n = from; n < to; n++) d += ` ${segment(n, n + 1, width)}`;
  return d;
}

/**
 * Short side-roots off some segments, pointing away from the centre line.
 * The midpoint of each segment is exact: with these control points the curve
 * passes through the average of its two ends at t = 0.5.
 */
function rootlets(from: number, to: number, width: number): string[] {
  const out: string[] = [];
  for (let n = from; n < to; n++) {
    if (hash(n) % 3 !== 0) continue;
    const mx = ((xOf(n) + xOf(n + 1)) / 200) * width;
    const my = (yOf(n) + yOf(n + 1)) / 2;
    const side = mx < width / 2 ? -1 : 1;
    const reach = 14 + (hash(n + 7) % 12);
    out.push(`M ${mx} ${my} q ${side * reach * 0.3} ${reach * 0.2}, ${side * reach} ${reach * 0.9}`);
    if (hash(n) % 2 === 0) out.push(`M ${mx + side * reach * 0.55} ${my + reach * 0.45} q ${side * 4} 2, ${side * 7} -3`);
  }
  return out;
}

export function LessonPath({
  languageId,
  total,
  current,
  from,
  initial,
  justCompleted,
}: {
  languageId: string;
  total: number;
  current: number;
  /** Level number of initial[0]. */
  from: number;
  initial: PathLevel[];
  /** Set right after a first completion: animate the trail on from this level. */
  justCompleted: number | null;
}) {
  const router = useRouter();
  const container = useRef<HTMLDivElement>(null);
  const currentNode = useRef<HTMLAnchorElement>(null);
  const [width, setWidth] = useState(400);
  const [levels, setLevels] = useState(() => new Map(initial.map((l) => [l.number, l])));
  const [range, setRange] = useState({ lo: from, hi: from + initial.length - 1 });
  const loading = useRef(false);
  // After a completion the new level starts closed and opens once the trail reaches it.
  const animating = justCompleted !== null && justCompleted + 1 === current;
  const [revealed, setRevealed] = useState(!animating);
  const [hint, setHint] = useState<number | null>(null);

  // Measure the width, so the SVG and the nodes share one coordinate space.
  useLayoutEffect(() => {
    const el = container.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Open on the learner's level; after a completion, draw on to the next one.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // After the router's own scroll-to-top on navigation, not before it. A
    // long way down the path is a jump; smooth scrolling 50,000px is a wait.
    const scroll = setTimeout(() => {
      const node = currentNode.current;
      if (!node) return;
      const far = Math.abs(node.getBoundingClientRect().top - window.innerHeight / 2) > window.innerHeight * 2;
      node.scrollIntoView({ block: "center", behavior: reduce || far ? "auto" : "smooth" });
    }, 120);
    if (!animating) return () => clearTimeout(scroll);
    const open = setTimeout(() => setRevealed(true), reduce ? 0 : 900);
    // Drop ?completed= so a refresh doesn't replay it.
    const clean = setTimeout(() => router.replace("/learn", { scroll: false }), 1600);
    return () => {
      clearTimeout(scroll);
      clearTimeout(open);
      clearTimeout(clean);
    };
  }, [animating, router]);

  useEffect(() => {
    if (hint === null) return;
    const timer = setTimeout(() => setHint(null), 2200);
    return () => clearTimeout(timer);
  }, [hint]);

  const load = useCallback(
    async (start: number) => {
      if (loading.current || start < 1 || start > total) return;
      loading.current = true;
      try {
        const res = await fetch(`/api/courses/${encodeURIComponent(languageId)}/path?from=${start}&limit=${PAGE}`);
        if (!res.ok) return;
        const page = (await res.json()) as { levels: PathLevel[] };
        setLevels((prev) => {
          const next = new Map(prev);
          for (const level of page.levels) next.set(level.number, level);
          return next;
        });
        setRange((r) => ({
          lo: Math.min(r.lo, start),
          hi: Math.max(r.hi, start + page.levels.length - 1),
        }));
      } finally {
        loading.current = false;
      }
    },
    [languageId, total],
  );

  // Sentinels at both ends of what's loaded fetch the next page before it's needed.
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (entry.target === top.current && range.lo > 1) void load(Math.max(1, range.lo - PAGE));
          if (entry.target === bottom.current && range.hi < total) void load(range.hi + 1);
        }
      },
      { rootMargin: "900px 0px" },
    );
    if (top.current) observer.observe(top.current);
    if (bottom.current) observer.observe(bottom.current);
    return () => observer.disconnect();
  }, [load, range, total]);

  const height = PAD * 2 + total * ROW;
  const svgTop = Math.max(0, yOf(range.lo) - ROW);
  const svgHeight = yOf(range.hi) + ROW - svgTop;
  const walkedTo = Math.min(animating ? justCompleted! : current, range.hi);
  const visible = Array.from({ length: range.hi - range.lo + 1 }, (_, i) => levels.get(range.lo + i)).filter(
    (l): l is PathLevel => l !== undefined,
  );

  return (
    <div ref={container} className="relative mx-auto w-full max-w-md" style={{ height }}>
      <div ref={top} className="absolute inset-x-0" style={{ top: yOf(range.lo) }} aria-hidden />
      <div ref={bottom} className="absolute inset-x-0" style={{ top: yOf(range.hi) }} aria-hidden />

      {/* Only as tall as the loaded window: a single 100,000px SVG is past
          what browsers will paint as one layer, and the page went blank. The
          viewBox keeps page coordinates, so the paths need no offset. */}
      <svg
        className="pointer-events-none absolute left-0"
        style={{ top: svgTop }}
        width={width}
        height={svgHeight}
        viewBox={`0 ${svgTop} ${width} ${svgHeight}`}
        aria-hidden
      >
        {/* The whole trail, faint. */}
        <path d={trail(range.lo, range.hi, width)} fill="none" stroke="var(--border)" strokeWidth={12} strokeLinecap="round" />
        {rootlets(range.lo, range.hi, width).map((d, i) => (
          <path key={i} d={d} fill="none" stroke="var(--border)" strokeWidth={2.5} strokeLinecap="round" />
        ))}
        {/* The part already walked. */}
        {walkedTo > range.lo && (
          <path
            d={trail(range.lo, walkedTo, width)}
            fill="none"
            stroke="var(--forest)"
            strokeOpacity={0.75}
            strokeWidth={12}
            strokeLinecap="round"
          />
        )}
        {/* The step just taken, drawn on. */}
        {animating && justCompleted! >= range.lo && current <= range.hi && (
          <path
            d={`M ${(xOf(justCompleted!) / 100) * width} ${yOf(justCompleted!)} ${segment(justCompleted!, current, width)}`}
            fill="none"
            stroke="var(--forest)"
            strokeOpacity={0.75}
            strokeWidth={12}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray={1}
            strokeDashoffset={revealed ? 0 : 1}
            style={{ transition: "stroke-dashoffset 850ms ease-out" }}
          />
        )}
      </svg>

      <ol aria-label="Your learning path">
        {visible.map((level) => {
          const n = level.number;
          const state = n === current && animating && !revealed ? "locked" : level.state;
          const left = `calc(${xOf(n)}% - ${NODE / 2}px)`;
          const labelOnLeft = xOf(n) > 50;
          const status = { completed: "completed", current: "your next level", open: "open", locked: "locked" }[state];
          const label = `Level ${n}: ${level.title} — ${status}`;

          return (
            <li key={n} className="absolute" style={{ top: yOf(n) - NODE / 2, left, width: NODE, height: NODE }}>
              {state === "locked" ? (
                <button
                  type="button"
                  aria-label={label}
                  aria-disabled
                  onClick={() => setHint(n)}
                  className="glass grid h-full w-full place-items-center !rounded-full text-muted transition-transform duration-200 ease-out hover:scale-[1.04]"
                >
                  <LockIcon />
                </button>
              ) : (
                <Link
                  ref={n === current ? currentNode : undefined}
                  href={`/learn/${n}`}
                  aria-label={label}
                  title={level.title}
                  className={`group relative grid h-full w-full place-items-center rounded-full font-semibold transition-transform duration-200 ease-out hover:scale-[1.06] focus-visible:scale-[1.06] ${
                    state === "completed"
                      ? // Quieter than the current level, which shares the brand green.
                        "border-2 border-forest bg-background text-forest shadow-[0_8px_20px_-12px_var(--forest)]"
                      : state === "current"
                        ? `bg-accent-solid text-white shadow-[0_10px_26px_-10px_var(--accent)] ${animating ? "animate-unlock" : ""}`
                        : "glass !rounded-full text-[var(--accent-on-glass)]"
                  }`}
                >
                  {state === "current" && <span aria-hidden className="absolute inset-0 animate-breathe rounded-full bg-accent" />}
                  <span className="relative">{state === "completed" ? <CheckIcon /> : n}</span>
                </Link>
              )}

              {/* The current level says what it is; the rest keep the path quiet. */}
              {/* Glass surfaces set their own `position`, so each card sits in a
                  plain wrapper that does the positioning. */}
              {state === "current" && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${labelOnLeft ? "right-[calc(100%+14px)]" : "left-[calc(100%+14px)]"}`}>
                  <Link
                    href={`/learn/${n}`}
                    tabIndex={-1}
                    className="glass-strong block w-40 animate-fade-in px-4 py-3 transition-transform duration-200 ease-out hover:scale-[1.02] sm:w-52"
                  >
                    <span className="block text-xs font-medium text-accent">Level {n}</span>
                    <span className="block font-semibold leading-snug">{level.title}</span>
                    <span className="mt-1 block text-sm text-[var(--accent-on-glass)]">Start →</span>
                  </Link>
                </div>
              )}

              {hint === n && (
                <div className={`absolute top-1/2 -translate-y-1/2 ${labelOnLeft ? "right-[calc(100%+12px)]" : "left-[calc(100%+12px)]"}`}>
                  <span role="status" className="glass-strong block w-40 animate-fade-in px-3 py-2 text-xs text-muted">
                    Finish Level {n - 1} to open this one.
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {range.hi === total && (
        <p className="absolute inset-x-0 text-center text-sm text-muted" style={{ top: yOf(total) + NODE }}>
          More levels arrive as checked content is added.
        </p>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-6 w-6">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-5 w-5">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
