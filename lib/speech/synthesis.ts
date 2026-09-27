import "server-only";
import { getLanguage } from "@/lib/db/languages";
import { mmsCapabilities } from "./mms-client";
import { hasMachineVoice } from "./voices";

/*
 * Whether the app can read a language aloud in a machine voice: Google's
 * keyless voice (Kiswahili), or an MMS voice the speech server has loaded
 * (Gikuyu, Somali, Samburu, Teso …). Either way it is a machine voice and the
 * UI labels it so; a native recording, where one exists, always comes first.
 */
export async function canSynthesize(languageId: string): Promise<boolean> {
  if (hasMachineVoice(languageId)) return true;
  const iso = (await getLanguage(languageId))?.iso639_3;
  return Boolean(iso && (await mmsCapabilities()).tts.has(iso));
}
