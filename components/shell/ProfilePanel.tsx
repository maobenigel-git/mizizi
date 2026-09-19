"use client";

import Link from "next/link";
import { useEffect } from "react";
import { resetSession } from "@/lib/session/actions";
import type { ShellProfile } from "./AppShell";
import { Avatar } from "./Avatar";
import { WeekStrip } from "./WeekStrip";

const levelLabels: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/** Slide-over opened from the nav avatar, so the profile is never a page away. */
export function ProfilePanel({ profile, onClose }: { profile: ShellProfile; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats = [
    { label: "Day streak", value: profile.streak.current },
    { label: "Longest", value: profile.streak.longest },
    { label: "Freezes", value: profile.streak.freezes },
    { label: "XP", value: profile.xp },
  ];

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Your profile">
      <button
        type="button"
        aria-label="Close profile"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-ocean-dark/50"
      />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-sm animate-sheet-in flex-col gap-6 overflow-y-auto bg-background p-6 shadow-xl">
        <div className="flex items-center gap-4">
          <Avatar name={profile.displayName} color={profile.avatar} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold">{profile.displayName}</h2>
            <p className="text-sm text-muted">
              {[profile.languageName && `Learning ${profile.languageName}`, profile.level && levelLabels[profile.level]]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {profile.county && <p className="text-sm text-muted">{profile.county} County</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="self-start p-1 text-2xl leading-none text-muted hover:text-foreground">
            ×
          </button>
        </div>

        <Link href="/profile" className="rounded-xl bg-accent-solid px-4 py-2.5 text-center font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90">
          View full profile
        </Link>

        <dl className="grid grid-cols-4 gap-2 text-center">
          {stats.map((stat) => (
            <div key={stat.label} className="glass !rounded-xl px-1 py-3">
              <dd className="text-xl font-semibold text-gold">{stat.value}</dd>
              <dt className="text-xs text-muted">{stat.label}</dt>
            </div>
          ))}
        </dl>

        <section className="glass !rounded-xl space-y-3 p-4">
          <h3 className="text-sm font-medium">This week</h3>
          <WeekStrip activity={profile.activity} today={profile.today} />
        </section>

        <nav className="glass !rounded-xl divide-y divide-border text-sm">
          {[
            { href: "/notebook", label: `Notebook · ${profile.notebookCount} saved` },
            { href: "/learn", label: "Your learning path" },
            { href: "/community", label: "Community and contributions" },
          ].map((link) => (
            <Link key={link.href} href={link.href} className="flex justify-between px-4 py-3 hover:text-accent">
              {link.label} <span aria-hidden>→</span>
            </Link>
          ))}
        </nav>

        <form action={resetSession} className="mt-auto">
          <button type="submit" className="w-full rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition-colors duration-200 ease-out hover:border-red hover:text-red">
            Sign out and reset progress
          </button>
        </form>
      </aside>
    </div>
  );
}
