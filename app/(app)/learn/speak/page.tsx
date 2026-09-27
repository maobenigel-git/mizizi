import { redirect } from "next/navigation";
import { levelForSlug } from "@/lib/lessons/levels";
import { getSession } from "@/lib/session";

/** Speaking practice is a level on the path now; old links land on it. */
export default async function SpeakPage() {
  const { languageId } = await getSession();
  const level = languageId ? levelForSlug(languageId, "speaking") : undefined;
  redirect(level ? `/learn/${level}` : "/learn");
}
