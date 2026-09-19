"use client";

import { useState } from "react";
import { VoiceInput } from "@/components/voice/VoiceInput";

/**
 * The text box on /translate, with dictation wired into it. A client island so
 * the mic can write into the field; the form around it is still a plain GET,
 * so translating works with JavaScript off.
 */
export function TranslateField({ defaultValue, localeTag }: { defaultValue: string; localeTag?: string }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div className="space-y-2">
      <div className="relative">
        <input
          name="q"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          maxLength={200}
          placeholder="Type or speak a word, e.g. water"
          aria-label="Text to translate"
          className="glass-inset w-full px-4 py-3 pr-11 text-lg outline-none transition-all duration-200 ease-out focus:border-accent"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue("")}
            aria-label="Clear"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-muted transition-colors duration-200 ease-out hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="h-4 w-4">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        )}
      </div>
      <VoiceInput
        localeTag={localeTag}
        label="Speak"
        onInterim={setValue}
        onTranscript={(text) => setValue(text)}
      />
    </div>
  );
}
