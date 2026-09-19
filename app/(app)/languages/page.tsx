import type { Metadata } from "next";
import Link from "next/link";
import { LanguageCard } from "@/components/language/LanguageCard";
import { listFamilies, listLanguages } from "@/lib/db/languages";

export const metadata: Metadata = {
  title: "Languages · Mizizi",
};

export default async function LanguagesPage() {
  const [languages, families] = await Promise.all([listLanguages(), listFamilies()]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <Link href="/explore" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Explore
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Explore Kenya&apos;s languages</h1>
        <p className="text-muted">
          Data coverage varies by language. Help us expand your language.
        </p>
      </header>

      {families.map((family) => {
        const members = languages.filter((l) => l.family === family.id);
        if (members.length === 0) return null;
        return (
          <section key={family.id} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{family.name}</h2>
              <p className="text-sm text-muted">{family.description}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((language) => (
                <LanguageCard key={language.id} language={language} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
