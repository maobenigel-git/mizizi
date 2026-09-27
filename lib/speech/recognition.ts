import "server-only";
import { getLanguage } from "@/lib/db/languages";
import { dictationTagFor } from "./voices";
import { googleConfigured, googleLocales, googleRecognize } from "./google-stt";
import { mmsCapabilities, mmsConfigured, mmsTranscribe } from "./mms-client";

/*
 * Which recogniser can hear a learner in a given language.
 *
 * Providers are tried in order and the first that covers the language wins:
 *
 *   google   Cloud Speech-to-Text (managed, word confidence)          sw · luo · kam
 *   mms      self-hosted Meta MMS on a GPU (word confidence)         whatever the server
 *                                                                     reports — incl. Gikuyu
 *   browser  the Web Speech API in Chrome/Edge (transcript only)     sw
 *
 * A language with no recogniser gets no scored speaking step: pronunciation
 * exercises there become read-aloud practice and never block completion. We
 * never grade a language with another language's model.
 */

export type RecognizedWord = { word: string; confidence?: number };
export type Recognition = { transcript: string; words: RecognizedWord[]; provider: string };
export type RecognitionError = { error: "not_configured" | "unavailable" | "busy" };

type ServerProvider = {
  name: string;
  supports: (languageId: string) => Promise<boolean>;
  recognize: (audio: Buffer, languageId: string) => Promise<Recognition | RecognitionError>;
};

/** MMS addresses languages by ISO 639-3, which the registry records. */
async function isoOf(languageId: string): Promise<string | undefined> {
  return (await getLanguage(languageId))?.iso639_3 || undefined;
}

const serverProviders: ServerProvider[] = [
  {
    name: "google",
    supports: async (id) => googleConfigured() && id in googleLocales,
    recognize: googleRecognize,
  },
  {
    name: "mms",
    supports: async (id) => {
      if (!mmsConfigured()) return false;
      const iso = await isoOf(id);
      return Boolean(iso && (await mmsCapabilities()).asr.has(iso));
    },
    recognize: async (audio, id) => {
      const iso = await isoOf(id);
      return iso ? mmsTranscribe(audio, iso) : { error: "not_configured" };
    },
  },
];

async function providerFor(languageId: string): Promise<ServerProvider | undefined> {
  for (const provider of serverProviders) if (await provider.supports(languageId)) return provider;
  return undefined;
}

/** What the client needs to know to run a speaking exercise. */
export type RecognizerInfo =
  | { kind: "server"; provider: string }
  | { kind: "browser"; localeTag: string }
  | { kind: "none" };

export async function recognizerFor(languageId: string): Promise<RecognizerInfo> {
  const server = await providerFor(languageId);
  if (server) return { kind: "server", provider: server.name };
  const localeTag = dictationTagFor(languageId);
  return localeTag ? { kind: "browser", localeTag } : { kind: "none" };
}

export async function recognize(audio: Buffer, languageId: string): Promise<Recognition | RecognitionError> {
  const server = await providerFor(languageId);
  return server ? server.recognize(audio, languageId) : { error: "not_configured" };
}
