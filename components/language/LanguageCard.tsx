import Link from "next/link";
import type { Language } from "@/types";
import { CoverageBadge } from "./CoverageBadge";

export function LanguageCard({ language }: { language: Language }) {
  return (
    <Link
      href={`/languages/${language.id}`}
      className="glass !rounded-xl block p-4 transition-colors duration-200 ease-out hover:border-accent"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{language.name}</h3>
          {language.nativeName && language.nativeName !== language.name && (
            <p className="text-sm text-muted">{language.nativeName}</p>
          )}
        </div>
        <CoverageBadge tier={language.coverage} />
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-muted">{language.description}</p>
    </Link>
  );
}
