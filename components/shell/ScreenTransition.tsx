"use client";

import { ViewTransition } from "react";
import { usePathname } from "next/navigation";

const classes = { "nav-back": "screen-back", default: "screen" };

/**
 * Global transition layer. Keyed by pathname, so every route change unmounts
 * the old screen and mounts the new one inside the navigation transition.
 * Links can pass `transitionTypes={["nav-back"]}` to slide the other way.
 */
export function ScreenTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={pathname} enter={classes} exit={classes} default="none">
      <div className="screen flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
