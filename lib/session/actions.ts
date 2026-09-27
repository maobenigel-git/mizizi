"use server";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { counties } from "@/data/seed/counties";
import { getLanguage } from "@/lib/db/languages";
import { revalidatePath } from "next/cache";
import { interestTags, joinDirectory, leaveDirectory } from "@/lib/db/community";
import { listTasks, submitContribution } from "@/lib/db/contributions";
import { createAccount, loadState, verifyAccount } from "@/lib/db/accounts";
import { addNote, NOTE_MAX_LENGTH, removeNote } from "@/lib/db/notes";
import { getWord } from "@/lib/db/vocabulary";
import { allowSignInAttempt } from "@/lib/rate-limit";
import type { ProficiencyLevel } from "@/types";
import { normaliseContact, PASSWORD_MIN_LENGTH } from "./contact";
import { cookieOptions, getSession, restore, saveSession } from "./index";
import { recordSessionActivity, type LessonResult } from "./activity";
import { localDate } from "./streak";
import {
  COOKIE_COMPLETED,
  COOKIE_SESSION,
  COOKIE_STEP,
  NOTEBOOK_LIMIT,
  ONBOARDING_STEPS,
  SIGN_IN_PATH,
  type AvatarColor,
  type NotebookSource,
  type OnboardingStep,
  type SavedNote,
  emptySession,
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

/*
 * Accounts. Errors travel back as ?error=<code> so the forms stay plain server
 * components that work before (or without) JavaScript; the pages turn the code
 * into a sentence.
 */
export type AccountError = "contact" | "password" | "taken" | "credentials" | "limited";

export async function saveAccount(formData: FormData) {
  const fail = (error: AccountError): never => redirect(`/onboarding/account?error=${error}`);
  const contact = normaliseContact(String(formData.get("contact") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!contact) fail("contact");
  if (password.length < PASSWORD_MIN_LENGTH) fail("password");

  const session = await getSession();
  // Going back to this step after creating the account must not create a
  // second one; the account is already made, so just move on.
  if (session.accountId) await advanceTo("profile");

  const id = session.userId ?? randomUUID();
  const created = await createAccount(id, contact!, password);
  if (!created.ok) fail("taken");
  await saveSession({ ...session, userId: id, accountId: id, contact });
  await advanceTo("profile");
}

export async function signIn(formData: FormData) {
  const fail = (error: AccountError): never => redirect(`${SIGN_IN_PATH}?error=${error}`);
  const contact = normaliseContact(String(formData.get("contact") ?? ""));
  const password = String(formData.get("password") ?? "");
  if (!contact || !password) fail("credentials");
  if (!allowSignInAttempt(contact!)) fail("limited");

  const accountId = await verifyAccount(contact!, password);
  if (!accountId) fail("credentials");

  const stored = await loadState(accountId!);
  const session = restore(stored && typeof stored === "object" ? stored : {});
  await saveSession({ ...session, userId: accountId, accountId, contact });

  // An account whose owner never finished onboarding (no language yet) picks
  // up at the language step; everyone else goes straight home.
  const jar = await cookies();
  if (!session.languageId) {
    jar.set(COOKIE_STEP, String(ONBOARDING_STEPS.indexOf("language")), cookieOptions);
    redirect("/onboarding/language");
  }
  jar.set(COOKIE_COMPLETED, "true", cookieOptions);
  redirect("/today");
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

export type { LessonResult } from "./activity";

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

/**
 * Adds a word without toggling — for client screens (a lesson) that show their
 * own "saved" state and must not remove the word on a second tap.
 */
export async function saveToNotebook(wordId: string, source: NotebookSource): Promise<boolean> {
  const session = await getSession();
  if (!(await getWord(wordId))) return false;
  if (session.notebook.some((e) => e.id === wordId)) return true;
  const entry = { id: wordId, type: "word" as const, source, savedAt: localDate() };
  await saveSession({ ...session, notebook: [...session.notebook, entry].slice(-NOTEBOOK_LIMIT) });
  revalidatePath("/notebook");
  return true;
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

async function clearDevice(): Promise<never> {
  const jar = await cookies();
  for (const name of [COOKIE_COMPLETED, COOKIE_STEP, COOKIE_SESSION]) jar.delete(name);
  redirect("/onboarding/welcome");
}

/** Signs out of this device. Progress stays with the account, ready to sign back in. */
export async function signOut() {
  await clearDevice();
}

/**
 * Clears progress and starts over. For an account, the stored progress is
 * reset too — otherwise signing back in would quietly restore what the
 * learner asked to wipe. The account itself (and its sign-in) remains.
 */
export async function resetSession() {
  const session = await getSession();
  if (session.accountId) {
    await saveSession({
      ...emptySession,
      userId: session.userId,
      accountId: session.accountId,
      contact: session.contact,
    });
  }
  await clearDevice();
}


/*
 * Lesson notes. Stored in lib/db/notes, not the session cookie — see that
 * file for why. The cookie only carries the anonymous userId the notes hang
 * off, minted here on the first note if the learner has none yet.
 */
/*
 * The saved note comes back with the result so the lesson drawer can show it
 * straight away. A lesson is a client-rendered focus screen that does not
 * re-fetch between steps, so without this the learner saves a note and gets no
 * evidence it exists until they leave.
 */
export type NoteResult = { ok: true; note: SavedNote } | { ok: false; message: string };

export async function saveNote(formData: FormData): Promise<NoteResult> {
  const session = await getSession();
  const text = String(formData.get("text") ?? "").trim().slice(0, NOTE_MAX_LENGTH);
  if (!text) return { ok: false, message: "Write something first." };
  if (!session.languageId) return { ok: false, message: "Choose a language first." };

  const userId = session.userId ?? randomUUID();
  if (!session.userId) await saveSession({ ...session, userId });

  const note = {
    id: randomUUID(),
    text,
    context: String(formData.get("context") ?? "").trim().slice(0, 80) || undefined,
    createdAt: new Date().toISOString(),
  };
  await addNote({ ...note, userId, languageId: session.languageId });
  revalidatePath("/notebook");
  return { ok: true, note };
}

export async function deleteNote(id: string): Promise<void> {
  const { userId } = await getSession();
  // No userId means no notes of their own to delete.
  if (!userId) return;
  await removeNote(userId, id);
  revalidatePath("/notebook");
}
