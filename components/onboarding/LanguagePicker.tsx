"use client";

import { useState } from "react";
import { CoverageBadge } from "@/components/language/CoverageBadge";
import { chooseLanguage } from "@/lib/session/actions";
import type { Language, LanguageFamily } from "@/types";
import { onboardingButton, onboardingInput } from "./styles";

export function LanguagePicker({
  languages,
  families,
  initial,
}: {
  languages: Language[];
  families: LanguageFamily[];
  initial?: string;
}) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const isMatch = (l: Language) =>
    !needle || l.name.toLowerCase().includes(needle) || l.nativeName?.toLowerCase().includes(needle);
  const anyMatch = languages.some(isMatch);

  return (
    <form action={chooseLanguage} className="flex flex-1 flex-col gap-5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search languages"
        aria-label="Search languages"
        className={onboardingInput}
      />

      <div className="flex-1 space-y-6">
        {families.map((family) => {
          const members = languages.filter((l) => l.family === family.id);
          if (members.length === 0) return null;
          return (
            // Non-matches are hidden, not unmounted, so a selection survives searching.
            <section key={family.id} className={members.some(isMatch) ? "space-y-2" : "hidden"}>
              <h2 className="text-sm font-medium text-muted">{family.name}</h2>
              <div className="grid grid-cols-2 gap-2">
                {members.map((language) => (
                  // Native radios, so selection and submit work even before hydration.
                  <label key={language.id} className={isMatch(language) ? "cursor-pointer" : "hidden"}>
                    <input
                      type="radio"
                      name="languageId"
                      value={language.id}
                      defaultChecked={language.id === initial}
                      required
                      className="peer sr-only"
                    />
                    <span className="glass !rounded-xl flex h-full flex-col items-start gap-1.5 border-2 p-3 transition-colors duration-200 ease-out hover:border-ocean/50 peer-checked:border-ocean peer-checked:bg-ocean/10 peer-focus-visible:border-ocean">
                      <span className="font-medium leading-tight">{language.name}</span>
                      <CoverageBadge tier={language.coverage} />
                    </span>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
        {!anyMatch && <p className="text-sm text-muted">No languages match “{query}”.</p>}
      </div>

      <div className="sticky bottom-0 -mx-4 space-y-2 bg-background px-4 pt-2 pb-4">
        <p className="text-center text-xs text-muted">Data coverage varies by language. Help us expand your language.</p>
        <button type="submit" className={onboardingButton}>
          Continue
        </button>
      </div>
    </form>
  );
}
