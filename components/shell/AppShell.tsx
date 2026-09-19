"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { HOME_BACKGROUND, LOGO } from "@/lib/assets";
import type { AvatarColor, StreakState } from "@/lib/session/types";
import { Avatar } from "./Avatar";
import { ProfilePanel } from "./ProfilePanel";
import { ScreenTransition } from "./ScreenTransition";
import { StreakFlame } from "./StreakFlame";
import { ThemeToggle } from "./ThemeToggle";

export type ShellProfile = {
  displayName: string;
  avatar: AvatarColor;
  languageName?: string;
  level?: string;
  county?: string;
  streak: StreakState;
  streakAtRisk: boolean;
  xp: number;
  activity: Record<string, number>;
  today: string;
  notebookCount: number;
};

const tabs = [
  { href: "/today", label: "Home", icon: "m3 11 9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5" },
  { href: "/learn", label: "Learn", icon: "M12 6.5c-2-1.3-4.5-2-7.5-2v13c3 0 5.5.7 7.5 2m0-13c2-1.3 4.5-2 7.5-2v13c-3 0-5.5.7-7.5 2m0-13v13" },
  { href: "/explore", label: "Explore", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm3.5-12.5-2 5-5 2 2-5 5-2Z" },
  { href: "/translate", label: "Translate", icon: "M4 6h9M8.5 4v2m3 0c-.6 3.4-3 6.4-7 8m2.5-5c1 2 2.7 3.6 5 4.7M13 20l4-9 4 9m-6.7-3h5.4" },
  { href: "/practice", label: "Tutor", icon: "M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.4A8 8 0 1 1 21 12Z" },
  { href: "/notebook", label: "Notebook", icon: "M6 4h12v17l-6-4-6 4V4Z" },
];

/** Culture / heritage / community routes get the earth accent; the rest is ocean. */
const cultureRoutes = ["/explore", "/languages", "/culture", "/literature", "/community"];

function TabIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-6 w-6 shrink-0">
      <path d={path} />
    </svg>
  );
}

export function AppShell({
  profile,
  popup,
  children,
}: {
  profile: ShellProfile;
  /** Word of the Day sheet; rendered outside the screen so it survives navigation. */
  popup?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // Storing the pathname the panel was opened on closes it on any navigation.
  const [panelOpenOn, setPanelOpenOn] = useState<string | null>(null);
  const section = cultureRoutes.some((r) => pathname.startsWith(r)) ? "culture" : "learning";
  const isActive = (href: string) =>
    href === "/explore"
      ? section === "culture"
      : href === "/learn"
        ? pathname.startsWith("/learn")
        : pathname === href || pathname.startsWith(`${href}/`);

  // Drives the sliding pill behind the active tab. -1 on routes that aren't a
  // tab (a lesson, say), which hides the pill rather than parking it at Home.
  const activeIndex = tabs.findIndex((tab) => isActive(tab.href));

  return (
    <div data-section={section} className="flex min-h-full flex-1 flex-col">
      {/* The accent wash glass panels read against. Sits behind everything and
          follows the section accent, so culture routes warm up automatically. */}
      <div aria-hidden className="ambient" />

      {/* Home dashboard background: public/assets/bghome.png. It sits in the shell,
          outside the screen transition, so it always fills the viewport; if the
          file is absent the ambient wash shows through instead. */}
      {pathname === "/today" && (
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center opacity-90"
          style={{ backgroundImage: `url(${HOME_BACKGROUND})` }}
        />
      )}

      {/* Top rail: wordmark left, theme and profile right. Floats over the page
          rather than boxing it in, so the dock below is the only chrome. */}
      <header
        style={{ viewTransitionName: "app-header" }}
        className="pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-3 py-3 md:px-6"
      >
        <Link href="/today" aria-label="Mizizi home" className="glass press pointer-events-auto !rounded-full p-1.5 pr-3">
          <CharacterImage
            src={LOGO}
            name="Mizizi"
            className="h-9 w-auto"
            fallback={<span className="block px-2 text-lg font-semibold tracking-tight">Mizizi</span>}
          />
        </Link>

        <div className="glass pointer-events-auto flex items-center gap-1 !rounded-full p-1.5 pl-3">
          <StreakFlame count={profile.streak.current} atRisk={profile.streakAtRisk} />
          <span className="mx-1 h-5 w-px bg-[var(--glass-edge)]" aria-hidden />
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setPanelOpenOn(pathname)}
            aria-label="Open your profile"
            className="press rounded-full transition-transform duration-200 ease-out"
          >
            <Avatar name={profile.displayName} color={profile.avatar} />
          </button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-20 pb-32 md:px-8">
        <ScreenTransition>{children}</ScreenTransition>
      </main>

      {/* The dock. One control for every viewport: a centred, floating pill.
          Labels appear from sm up; below that the icons carry it. */}
      <nav
        aria-label="Main"
        style={{ viewTransitionName: "app-tabbar" }}
        className="fixed inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="glass relative flex !rounded-full p-1.5">
          {/* The pill slides between tabs instead of each tab lighting up
              independently — the movement is what ties the group together. */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-1.5 left-1.5 rounded-full bg-accent-solid shadow-[0_8px_20px_-8px_var(--accent)] transition-[transform,opacity] duration-300 ease-out"
            style={{
              width: `calc((100% - 0.75rem) / ${tabs.length})`,
              transform: `translateX(${activeIndex * 100}%)`,
              opacity: activeIndex === -1 ? 0 : 1,
            }}
          />
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive(tab.href) ? "page" : undefined}
              title={tab.label}
              className={`press relative z-10 flex flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-3 py-2 text-[11px] transition-colors duration-300 ease-out sm:px-5 ${
                isActive(tab.href) ? "font-medium text-white" : "text-muted hover:text-foreground"
              }`}
            >
              <TabIcon path={tab.icon} />
              <span className="hidden sm:block">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Lessons and reviews are focus screens: no popup over them. */}
      {!pathname.startsWith("/learn/") && !pathname.startsWith("/notebook/review") && popup}

      {panelOpenOn === pathname && <ProfilePanel profile={profile} onClose={() => setPanelOpenOn(null)} />}
    </div>
  );
}
