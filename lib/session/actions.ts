"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { counties } from "@/data/seed/counties";
import { getLanguage } from "@/lib/db/languages";
import { revalidatePath } from "next/cache";
import { interestTags, joinDirectory, leaveDirectory } from "@/lib/db/community";
import { listTasks, submitContribution } from "@/lib/db/contributions";
import { addNote, NOTE_MAX_LENGTH, removeNote } from "@/lib/db/notes";
import { getWord } from "@/lib/db/vocabulary";
import { getLesson } from "@/lib/lessons/orientation";
import type { ProficiencyLevel } from "@/types";
import { cookieOptions, getSession, saveSession } from "./index";
import { localDate, recordActivity } from "./streak";
import {
  COOKIE_COMPLETED,
  COOKIE_SESSION,
  COOKIE_STEP,
  DAILY_LESSON_GOAL,
  NOTEBOOK_LIMIT,
  ONBOARDING_STEPS,
  STREAK_MILESTONES,
  XP_PER_LESSON,
  type AvatarColor,
  type NotebookSource,
  type OnboardingStep,
  type Session,
} from "./types";

const avatars: AvatarColor[] = ["ocean", "earth", "forest", "deep"];
const levels: ProficiencyLevel[] = ["beginner", "intermediate", "advanced"];

/** Unlocks `step` (never re-locks a later one) and moves the learner to it. */
async function advanceTo(step: OnboardingStep): Promise<never> {
  const jar = await cookies();
  const unlocked = Number(jar.get(COOKIE_STEP)?.value) || 0;
  const index = ONBOARDING_STEPS.indexOf(step);
  jar.set(COOKIE_STEP, String(Math.max(unlocked, index)), cookieOptions);
  redirect(`/onboarding/${step}`);
}

export async function startOnboarding() {
  await advanceTo("account");
}

export async function saveAccount(formData: FormData) {
  const contact = String(formData.get("contact") ?? "").trim();
  if (!contact) redirect("/onboarding/account");
  // TODO: create the account with the auth provider (phone-first). The
  // password field is deliberately not read or stored until then.
  await saveSession({ ...(await getSession()), contact });
  await advanceTo("profile");
}

export async function saveProfile(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 40);
  if (!displayName) redirect("/onboarding/profile");
  const avatar = String(formData.get("avatar")) as AvatarColor;
  const county = String(formData.get("county") ?? "");
  await saveSession({
    ...(await getSession()),
    displayName,
    avatar: avatars.includes(avatar) ? avatar : "ocean",
    county: counties.includes(county) ? county : undefined,
  });
  await advanceTo("language");
}

export async function chooseLanguage(formData: FormData) {
  const language = await getLanguage(String(formData.get("languageId") ?? ""));
  if (!language) redirect("/onboarding/language");
  await saveSession({ ...(await getSession()), languageId: language.id });
  await advanceTo("level");
}

export async function chooseLevel(formData: FormData) {
  const level = String(formData.get("level")) as ProficiencyLevel;
  if (!levels.includes(level)) redirect("/onboarding/level");
  // Choosing a level finishes onboarding: the learner lands on their home
  // dashboard and picks what to do first.
  const session = await getSession();
  await saveSession({ ...session, level, userId: session.userId ?? randomUUID(), joinedAt: session.joinedAt ?? localDate() });
  (await cookies()).set(COOKIE_COMPLETED, "true", cookieOptions);
  redirect("/today");
}

/** Edits from the profile page. */
export async function updateProfile(formData: FormData) {
  const session = await getSession();
  const displayName = String(formData.get("displayName") ?? "").trim().slice(0, 40) || session.displayName;
  const avatar = String(formData.get("avatar")) as AvatarColor;
  const county = String(formData.get("county") ?? "");
  const level = String(formData.get("level")) as ProficiencyLevel;
  const language = await getLanguage(String(formData.get("languageId") ?? ""));
  await saveSession({
    ...session,
    displayName,
    avatar: avatars.includes(avatar) ? avatar : session.avatar,
    county: counties.includes(county) ? county : undefined,
    level: levels.includes(level) ? level : session.level,
    languageId: language?.id ?? session.languageId,
  });
  redirect("/profile?saved=1");
}

export type LessonResult = {
  streak: number;
  streakIncremented: boolean;
  /** Set when this activity took the streak to 7, 30, 100 or 365 days. */
  milestone: number | null;
  lessonsToday: number;
  goal: number;
  xpEarned: number;
};

/** One qualifying activity: daily count, streak (once per day) and XP. */
function recordSessionActivity(session: Session): { session: Session; result: LessonResult } {
  const today = localDate();
  const { streak, incremented } = recordActivity(session.streak, today);
  const lessonsToday = (session.activity[today] ?? 0) + 1;
  const recent = Object.entries(session.activity).sort().slice(-13);
  return {
    session: {
      ...session,
      streak,
      xp: session.xp + XP_PER_LESSON,
      activity: { ...Object.fromEntries(recent), [today]: lessonsToday },
    },
    result: {
      streak: streak.current,
      streakIncremented: incremented,
      milestone: incremented && STREAK_MILESTONES.includes(streak.current) ? streak.current : null,
      lessonsToday,
      goal: DAILY_LESSON_GOAL,
      xpEarned: XP_PER_LESSON,
    },
  };
}

/** Records a finished lesson. */
export async function completeLesson(slug: string): Promise<LessonResult> {
  const current = await getSession();
  const lesson = current.languageId ? getLesson(current.languageId, slug) : undefined;
  if (!lesson) throw new Error("Unknown lesson");

  const { session, result } = recordSessionActivity(current);
  await saveSession({
    ...session,
    userId: session.userId ?? randomUUID(),
    completedLessons: [...new Set([...session.completedLessons, lesson.id])],
  });
  return result;
}

/** A finished notebook review counts as a qualifying activity too. */
export async function completeReview(): Promise<LessonResult> {
  const { session, result } = recordSessionActivity(await getSession());
  await saveSession(session);
  return result;
}

export async function toggleNotebook(wordId: string, source: NotebookSource) {
  const session = await getSession();
  if (!(await getWord(wordId))) return;
  const notebook = session.notebook.some((e) => e.id === wordId)
    ? session.notebook.filter((e) => e.id !== wordId)
    : [...session.notebook, { id: wordId, type: "word" as const, source, savedAt: localDate() }].slice(-NOTEBOOK_LIMIT);
  await saveSession({ ...session, notebook });
}

export async function dismissWordOfDay() {
  await saveSession({ ...(await getSession()), wotdSeen: localDate() });
}

export async function switchLanguage(formData: FormData) {
  const language = await getLanguage(String(formData.get("languageId") ?? ""));
  if (!language) return;
  await saveSession({ ...(await getSession()), languageId: language.id });
  redirect("/learn");
}

/** Opt in to the discovery directory (or update the listing). */
export async function joinCommunity(formData: FormData) {
  const session = await getSession();
  const interests = formData.getAll("interests").map(String).filter((t) => interestTags.includes(t));
  const speaks = (await getLanguage(String(formData.get("speaks") ?? "")))?.id;
  const userId = session.userId ?? randomUUID();
  await joinDirectory({
    userId,
    displayName: session.displayName,
    avatar: session.avatar,
    county: session.county,
    speaks: speaks ? [speaks] : [],
    learning: session.languageId ? [session.languageId] : [],
    interests,
  });
  await saveSession({ ...session, userId, interests, speaks, inDirectory: true });
  revalidatePath("/community");
}

export async function leaveCommunity() {
  const session = await getSession();
  if (session.userId) await leaveDirectory(session.userId);
  await saveSession({ ...session, inDirectory: false });
  revalidatePath("/community");
}

export async function submitTask(formData: FormData) {
  const task = listTasks().find((t) => t.key === String(formData.get("taskKey")));
  const content = String(formData.get("content") ?? "").trim().slice(0, 500);
  if (!task || !content) return;
  const session = await getSession();
  const userId = session.userId ?? randomUUID();
  await submitContribution(task, userId, content);
  await saveSession({ ...session, userId, xp: session.xp + 5 });
  redirect(`/community/contribute?thanks=${encodeURIComponent(task.key)}`);
}

/** Clears everything and sends the learner back through onboarding. */
export async function resetSession() {
  const jar = await cookies();
  for (const name of [COOKIE_COMPLETED, COOKIE_STEP, COOKIE_SESSION]) jar.delete(name);
  redirect("/onboarding/welcome");
}


/*
 * Lesson notes. Stored in lib/db/notes, not the session cookie — see that
 * file for why. The cookie only carries the anonymous userId the notes hang
 * off, minted here on the first note if the learner has none yet.
 */
export type NoteResult = { ok: true } | { ok: false; message: string };

export async function saveNote(formData: FormData): Promise<NoteResult> {
  const session = await getSession();
  const text = String(formData.get("text") ?? "").trim().slice(0, NOTE_MAX_LENGTH);
  if (!text) return { ok: false, message: "Write something first." };
  if (!session.languageId) return { ok: false, message: "Choose a language first." };

  const userId = session.userId ?? randomUUID();
  if (!session.userId) await saveSession({ ...session, userId });

  await addNote({
    id: randomUUID(),
    userId,
    text,
    languageId: session.languageId,
    context: String(formData.get("context") ?? "").trim().slice(0, 80) || undefined,
    createdAt: new Date().toISOString(),
  });
  revalidatePath("/notebook");
  return { ok: true };
}

export async function deleteNote(id: string): Promise<void> {
  const { userId } = await getSession();
  // No userId means no notes of their own to delete.
  if (!userId) return;
  await removeNote(userId, id);
  revalidatePath("/notebook");
}
