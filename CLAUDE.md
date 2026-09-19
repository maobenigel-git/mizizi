@AGENTS.md

# Mizizi

Kenya language & culture platform. The source of truth for product and architecture
decisions is `docs/spec.md`; read the relevant section before building a feature.

Non-negotiables from the spec:

- Never hard-code a language count or per-language pages; everything flows from the registry
  (`/languages/[language]`).
- Every linguistic/cultural record carries provenance (source, license, verified). Don't
  invent language data, translations, ISO codes or cultural claims. Leave a field empty
  rather than guessing.
- Translations carry a confidence tier. AI output is never presented as a verified translation.
- The frontend never calls the model directly; AI goes through `app/api/*` → `lib/ai`.
- Literature licensing is separate from corpus licensing. No full text for copyrighted books.
- Theme: white background, black text by default; dark is opt-in per device via the toggle in
  the shell (`<html data-theme="dark">`), never from the OS setting. `ocean` for learning UI,
  `earth` for culture/heritage/community (both via the `accent` token), `forest` for success,
  `red` for errors, `gold` only for streaks/XP. 200–300ms ease-out transitions, no bounce.
- Surfaces are glass: use the `.glass` / `.glass-strong` / `.glass-inset` classes from
  `app/globals.css` rather than `border border-border bg-surface`. Radii come from
  `--radius-panel` and `--radius-control`. Interactive controls get `.press`.
- Navigation is one floating dock at the bottom centre (`components/shell/AppShell`), on every
  breakpoint. There is no sidebar; don't reintroduce one.
- Machine translation and machine voice are clearly labelled as such and never presented as
  verified data or as a native-speaker recording.
- Every route change animates through `components/shell/ScreenTransition`; don't add per-page
  transition wrappers.
- Learner state goes through `lib/session`; shared data goes through `lib/db`. Pages never read
  `data/` directly.
