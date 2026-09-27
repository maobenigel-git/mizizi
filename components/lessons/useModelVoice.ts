"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Plays how a word or phrase should sound, from the best source there is:
 *
 *   1. a native-speaker recording (audioUrl), always preferred
 *   2. the machine voice — /api/speech, then the device's own voice for the
 *      same language — only where the language has one (Kiswahili today)
 *
 * and otherwise nothing: a Dholuo word read in an English or Kiswahili voice
 * would teach the wrong sounds. `source` tells the UI which one played, so a
 * machine voice is always labelled as one.
 */

export type VoiceSource = "native" | "machine";

export function useModelVoice({ languageId, canSpeak, speechTag }: { languageId: string; canSpeak: boolean; speechTag?: string }) {
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState<VoiceSource | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    audio.current?.pause();
    window.speechSynthesis?.cancel();
    setPlaying(false);
  }, []);
  useEffect(() => stop, [stop]);

  const playUrl = useCallback(async (url: string, kind: VoiceSource, revoke = false) => {
    const el = new Audio(url);
    audio.current = el;
    el.onended = () => {
      setPlaying(false);
      if (revoke) URL.revokeObjectURL(url);
    };
    await el.play();
    setSource(kind);
    setPlaying(true);
  }, []);

  const deviceVoice = useCallback(
    (text: string): boolean => {
      const synth = window.speechSynthesis;
      if (!synth || !speechTag) return false;
      const base = speechTag.split("-")[0];
      const voice = synth.getVoices().find((v) => v.lang === speechTag) ?? synth.getVoices().find((v) => v.lang.startsWith(base));
      if (!voice) return false;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = 0.9;
      utterance.onend = () => setPlaying(false);
      synth.cancel();
      synth.speak(utterance);
      setSource("machine");
      setPlaying(true);
      return true;
    },
    [speechTag],
  );

  /** Resolves false when there is no voice at all for this text. */
  const play = useCallback(
    async (text: string, audioUrl?: string): Promise<boolean> => {
      stop();
      try {
        if (audioUrl) {
          await playUrl(audioUrl, "native");
          return true;
        }
        if (!canSpeak) return false;
        const res = await fetch(`/api/speech?lang=${encodeURIComponent(languageId)}&text=${encodeURIComponent(text)}`);
        if (res.ok) {
          await playUrl(URL.createObjectURL(await res.blob()), "machine", true);
          return true;
        }
        return deviceVoice(text);
      } catch {
        return deviceVoice(text);
      }
    },
    [canSpeak, deviceVoice, languageId, playUrl, stop],
  );

  return { play, stop, playing, source };
}
