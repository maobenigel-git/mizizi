import "server-only";
import { getLanguage } from "@/lib/db/languages";
import { listVocabulary, type Word } from "@/lib/db/vocabulary";
import { ENGLISH } from "@/lib/translation/codes";
import { googleSupports, googleTranslate } from "@/lib/translation/google";
import type { TutorReply, TutorTurn } from "./grounding";

/*
 * The tutor with no model behind it.
 *
 * Every other provider needs a key. This one needs nothing, so the Tutor tab
 * is a working feature on a fresh clone instead of an error state. It answers
 * from the same two sources the model providers are grounded in — the word
 * graph and Google Translate — and it cannot hallucinate, because it never
 * generates language: every term it prints was looked up.
 *
 * It is not pretending to be an LLM. Replies say so, and the UI labels the
 * provider, so nobody mistakes this for the AI tutor.
 */

const UNVERIFIED = "It is seed data, still awaiting verification by a speaker.";

export async function groundedReply(
  languageId: string,
  history: TutorTurn[],
): Promise<TutorReply> {
  const question = history[history.length - 1]?.content ?? "";
  const [language, words] = await Promise.all([getLanguage(languageId), listVocabulary(languageId)]);
  const name = language?.name ?? languageId;
  const asked = question.toLowerCase();

  const reply = (text: string): TutorReply => ({ status: "ok", text, provider: "grounded" });

  if (words.length === 0) {
    return reply(
      `I have no verified ${name} vocabulary loaded yet, so there is nothing I can teach you without guessing — and I would rather say so than invent it. You can add the first words from the Community tab.`,
    );
  }

  // "what does X mean" / "how do you say X" — the two shapes worth parsing.
  const quoted = question.match(/["“']([^"”']{1,40})["”']/)?.[1];
  const sayMatch = question.match(/how (?:do|would) (?:you|i) say ([\w\s'-]{1,40})/i)?.[1];
  const meanMatch = question.match(/what does ([\w\s'-]{1,40}?) mean/i)?.[1];
  const term = (quoted ?? sayMatch ?? meanMatch)?.trim();

  if (term) return reply(await lookup(term, languageId, name, words));

  if (/\b(quiz|test|practi[sc]e)\b/.test(asked)) return reply(quiz(name, words));

  if (/\bgreet|\b(hello|hi|jambo|habari)\b/.test(asked)) {
    const greeting = words.find((w) => /welcome|hello|greet|morning/i.test(w.meaning));
    if (greeting) return reply(teach(greeting, name));
  }

  if (/\b(what can you|help|teach me|start|today)\b/.test(asked)) {
    return reply(
      `I can teach you the ${words.length} ${name} ${words.length === 1 ? "word" : "words"} we have checked so far: ${words.map((w) => w.term).join(", ")}. Ask me what one of them means, or say "quiz me". ${UNVERIFIED}`,
    );
  }

  // Anything else: teach a word rather than free-associating.
  const pick = words[Math.floor(Math.random() * words.length)];
  return reply(
    `I am the offline tutor — no AI model is connected, so I only answer from checked data and never guess. Here is a ${name} word: ${teach(pick, name)}`,
  );
}

function teach(word: Word, name: string): string {
  const lines = [`${word.term} means "${word.meaning}" in ${name}.`];
  if (word.example) lines.push(`Example: ${word.example} — "${word.exampleMeaning}"`);
  if (!word.verified) lines.push(UNVERIFIED);
  return lines.join(" ");
}

function quiz(name: string, words: Word[]): string {
  const pick = words[Math.floor(Math.random() * words.length)];
  return `Here is a quick one. What does "${pick.term}" mean in ${name}? Ask me "what does ${pick.term} mean" when you want the answer.`;
}

/** Word graph first, then Google as a clearly-labelled machine fallback. */
async function lookup(term: string, languageId: string, name: string, words: Word[]): Promise<string> {
  const needle = term.toLowerCase().replace(/[.!?,]+$/g, "");

  const byTerm = words.find((w) => w.term.toLowerCase() === needle);
  if (byTerm) return teach(byTerm, name);

  const byMeaning = words.find((w) => w.meaning.toLowerCase() === needle);
  if (byMeaning) return `"${term}" is ${byMeaning.term} in ${name}. ${teach(byMeaning, name)}`;

  if (googleSupports(languageId)) {
    const machine = await googleTranslate(term, ENGLISH, languageId);
    if (machine) {
      return `Our checked word list has no entry for "${term}". Google Translate gives ${machine}, but that is machine output, not a verified ${name} translation — treat it as a rough guide only.`;
    }
  }
  return `I have no verified ${name} translation for "${term}", and I will not invent one. If you speak ${name}, you can add it from the Community tab.`;
}
