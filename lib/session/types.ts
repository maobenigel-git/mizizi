import type { ProficiencyLevel } from "@/types";

export const ONBOARDING_STEPS = [
  "welcome",
  "account",
  "profile",
  "language",
  "level",
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/*
 * Local development escape hatch, defined here so the proxy and the route
 * handlers agree on it. Both conditions are required, and `next build` pins
 * NODE_ENV to "production", so it cannot be switched on in a deployed build.
 */
export const SKIP_ONBOARDING =
  process.env.NODE_ENV === "development" && process.env.DEV_SKIP_ONBOARDING === "true";

/** Cookie names. The proxy reads the first two to gate every route. */
export const COOKIE_COMPLETED = "onboarding_completed";
export const COOKIE_STEP = "onboarding_step";
export const COOKIE_SESSION = "mizizi_session";

export const DAILY_LESSON_GOAL = 3;
export const XP_PER_LESSON = 10;

export type AvatarColor = "ocean" | "earth" | "forest" | "deep";

export type StreakState = {
  current: number;
  longest: number;
  freezes: number;
  /** YYYY-MM-DD in the user's timezone. */
  lastActivityDate?: string;
};

export type NotebookSource = "word_of_day" | "lesson" | "culture_article" | "translate";

export type NotebookEntry = {
  /** Vocabulary id, `${languageId}:${term}`. */
  id: string;
  type: "word" | "phrase" | "sentence";
  source: NotebookSource;
  savedAt: string;
};

export const NOTEBOOK_LIMIT = 40;

/** Here rather than lib/db/notes so client components can import it. */
export const NOTE_MAX_LENGTH = 500;

export const STREAK_MILESTONES = [7, 30, 100, 365];

export type Session = {
  /** Date onboarding was completed (YYYY-MM-DD). */
  joinedAt?: string;
  /** Anonymous id used to attribute contributions until real auth exists. */
  userId?: string;
  contact?: string;
  displayName: string;
  avatar: AvatarColor;
  county?: string;
  languageId?: string;
  level?: ProficiencyLevel;
  /** Lesson ids, `${languageId}:${slug}`. */
  completedLessons: string[];
  /** Lessons completed per day, keyed YYYY-MM-DD. Trimmed to recent days. */
  activity: Record<string, number>;
  streak: StreakState;
  xp: number;
  notebook: NotebookEntry[];
  /** Date the Word of the Day popup was last dismissed (YYYY-MM-DD). */
  wotdSeen?: string;
  interests: string[];
  /** A language the member already speaks, for directory matching. */
  speaks?: string;
  /** Explicit opt-in to be listed in the community directory. */
  inDirectory?: boolean;
};

export const emptySession: Session = {
  displayName: "Learner",
  avatar: "ocean",
  completedLessons: [],
  activity: {},
  streak: { current: 0, longest: 0, freezes: 0 },
  xp: 0,
  notebook: [],
  interests: [],
};
