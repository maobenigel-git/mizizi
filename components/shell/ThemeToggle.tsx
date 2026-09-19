"use client";

import { useSyncExternalStore } from "react";

/*
 * Light/dark switch. Dark is opt-in and remembered per device, never taken from
 * the OS setting — white-on-black is the product's default look and the theme
 * tokens in globals.css are built around that.
 *
 * The choice is applied by the inline script in app/layout.tsx before paint, so
 * this component only has to stay in sync with what is already on <html>.
 */

export const THEME_KEY = "mizizi-theme";

type Theme = "light" | "dark";

function apply(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") root.dataset.theme = "dark";
  else delete root.dataset.theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the theme still applies for this visit.
  }
}

/*
 * <html data-theme> is the single source of truth: the pre-paint script writes
 * it, this component reads it. Subscribing to the attribute rather than holding
 * a copy in state means the button can never disagree with the page, and the
 * server snapshot ("light") matches the server's bare <html>.
 */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}

const readTheme = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => "light" as Theme);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    // Let the browser cross-fade the whole page rather than snapping colours.
    const start = (document as Document & { startViewTransition?: (cb: () => void) => void }).startViewTransition;
    if (start && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      start.call(document, () => apply(next));
    } else {
      apply(next);
    }
  }

  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`press grid h-10 w-10 place-items-center rounded-full text-foreground transition-colors duration-200 ease-out hover:text-accent ${className}`}
    >
      {/* Both icons are always mounted and cross-faded, so the swap is a
          transition rather than a pop-in. */}
      <span className="relative grid h-5 w-5 place-items-center">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`col-start-1 row-start-1 h-5 w-5 transition-all duration-300 ease-out ${dark ? "scale-50 opacity-0" : "scale-100 opacity-100"}`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`col-start-1 row-start-1 h-5 w-5 transition-all duration-300 ease-out ${dark ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      </span>
    </button>
  );
}
