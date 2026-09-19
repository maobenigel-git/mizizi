import Link from "next/link";
import { notFound } from "next/navigation";
import { CharacterImage } from "@/components/assets/CharacterImage";
import { CoverageBadge } from "@/components/language/CoverageBadge";
import { characterFor } from "@/lib/assets";
import { getLanguage, listVarieties } from "@/lib/db/languages";
import { getSession } from "@/lib/session";
import { switchLanguage } from "@/lib/session/actions";

export async function generateMetadata({ params }: PageProps<"/languages/[language]">) {
  const { language: id } = await params;
  const language = await getLanguage(id);
  return { title: language ? `${language.name} · Mizizi` : "Language not found" };
}

export default async function LanguagePage({ params }: PageProps<"/languages/[language]">) {
  const { language: id } = await params;
  const language = await getLanguage(id);
  if (!language) notFound();

  const [varieties, parent, session] = await Promise.all([
    listVarieties(language.id),
    language.parentId ? getLanguage(language.parentId) : undefined,
    getSession(),
  ]);
  const learning = session.languageId === language.id;

  return (
    <article className="space-y-8">
      <div className="flex flex-wrap-reverse items-center justify-between gap-6">
      <header className="min-w-0 flex-1 space-y-3">
        <Link href="/languages" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← All languages
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{language.name}</h1>
          <CoverageBadge tier={language.coverage} />
          {language.status === "endangered" && (
            <span className="rounded-full bg-earth px-2 py-0.5 text-xs font-medium text-white">
              Endangered
            </span>
          )}
        </div>
        {language.nativeName && language.nativeName !== language.name && (
          <p className="text-lg text-muted">{language.nativeName}</p>
        )}
        <p className="max-w-2xl">{language.description}</p>
      </header>
      <CharacterImage src={characterFor(language.id)} name={`${language.name} character`} className="h-64 shrink-0" />
      </div>

      <div className="flex flex-wrap gap-3">
        <form action={switchLanguage}>
          <input type="hidden" name="languageId" value={language.id} />
          <button type="submit" disabled={learning} className="rounded-xl bg-accent-solid px-5 py-2.5 font-semibold text-white transition-opacity duration-200 ease-out hover:opacity-90 disabled:opacity-50">
            {learning ? "You are learning this" : `Learn ${language.name}`}
          </button>
        </form>
        <Link href={`/culture/${language.parentId ?? language.id}`} className="rounded-xl border border-accent px-5 py-2.5 font-medium text-accent hover:bg-accent/10">
          Culture &amp; heritage
        </Link>
        <Link href={`/translate?to=${language.id}`} className="rounded-xl border border-accent px-5 py-2.5 font-medium text-accent hover:bg-accent/10">
          Translate
        </Link>
      </div>

      <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-muted">Family</dt>
        <dd className="capitalize">{language.family}</dd>
        {language.iso639_3 && (
          <>
            <dt className="text-muted">ISO 639-3</dt>
            <dd className="font-mono">{language.iso639_3}</dd>
          </>
        )}
        {parent && (
          <>
            <dt className="text-muted">Part of</dt>
            <dd>
              <Link href={`/languages/${parent.id}`} className="text-accent hover:underline">
                {parent.name}
              </Link>
            </dd>
          </>
        )}
      </dl>

      {varieties.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Varieties</h2>
          <ul className="flex flex-wrap gap-2">
            {varieties.map((v) => (
              <li key={v.id}>
                <Link
                  href={`/languages/${v.id}`}
                  className="glass !rounded-lg px-3 py-1.5 text-sm hover:border-accent"
                >
                  {v.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Sources</h2>
        {language.sources.length > 0 ? (
          <ul className="list-disc pl-5 text-sm">
            {language.sources.map((s) => (
              <li key={s.id}>
                {s.url ? (
                  <a href={s.url} className="text-accent hover:underline" rel="noreferrer" target="_blank">
                    {s.title}
                  </a>
                ) : (
                  s.title
                )}
                {s.license && <span className="text-muted"> · {s.license}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No sources linked yet.</p>
        )}
        {!language.verified && (
          <p className="text-xs text-muted">This profile has not yet been verified against its sources.</p>
        )}
      </section>
    </article>
  );
}
