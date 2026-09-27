import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { featureArt, type FeatureArtId } from "./FeatureArt";

/*
 * "Explore Mizizi": every destination as a card with an illustration that
 * peeks over its top edge. A vertical rail beside the day on wide screens, a
 * two-column grid on phones.
 *
 * Artwork: public/assets/features/<id>.png when present (e.g. 3D renders),
 * otherwise the drawn illustration in ./FeatureArt.
 */

const features: { id: FeatureArtId; href: string; title: string; detail: string; icon: string }[] = [
  { id: "lessons", href: "/learn", title: "Lessons", detail: "Follow your learning path", icon: "M12 6.5c-2-1.3-4.5-2-7.5-2v13c3 0 5.5.7 7.5 2m0-13c2-1.3 4.5-2 7.5-2v13c-3 0-5.5.7-7.5 2m0-13v13" },
  { id: "tutor", href: "/practice", title: "AI tutor", detail: "Practise in conversation", icon: "M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.4A8 8 0 1 1 21 12Z" },
  { id: "translate", href: "/translate", title: "Translate", detail: "Between Kenyan languages", icon: "M4 6h9M8.5 4v2m3 0c-.6 3.4-3 6.4-7 8m2.5-5c1 2 2.7 3.6 5 4.7M13 20l4-9 4 9m-6.7-3h5.4" },
  { id: "notebook", href: "/notebook", title: "Notebook", detail: "Review your saved words", icon: "M6 4h12v17l-6-4-6 4V4Z" },
  { id: "languages", href: "/languages", title: "Languages", detail: "Browse the full catalogue", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9ZM3.5 9h17m-17 6h17" },
  { id: "culture", href: "/culture", title: "Culture", detail: "Traditions and heritage", icon: "M12 3 3 8v2h18V8l-9-5ZM5 10v8m4.7-8v8m4.6-8v8M19 10v8M3 21h18v-3H3v3Z" },
  { id: "literature", href: "/literature", title: "Literature", detail: "Kenyan books and authors", icon: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h10M9 8h5" },
  { id: "community", href: "/community", title: "Community", detail: "Meet people and contribute", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5m2 9a6 6 0 0 0-3-5.2" },
];

const artDir = path.join(process.cwd(), "public", "assets", "features");

export function FeatureRail() {
  return (
    <nav aria-label="Explore Mizizi" className="space-y-4">
      <h2 className="w-fit rounded-[var(--radius-control)] bg-background/85 px-3 py-1.5 text-lg font-semibold backdrop-blur-sm">
        Explore Mizizi
      </h2>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-8 pt-6 sm:grid-cols-4 lg:grid-cols-1 lg:gap-y-8">
        {features.map((f) => {
          const Art = featureArt[f.id];
          const image = existsSync(path.join(artDir, `${f.id}.png`)) ? `/assets/features/${f.id}.png` : undefined;
          return (
            <li key={f.id}>
              <Link
                href={f.href}
                className="press group relative flex min-h-24 flex-col justify-end gap-0.5 rounded-[var(--radius-panel)] border border-border bg-surface/90 p-4 pt-8 text-foreground shadow-[0_10px_24px_-18px_rgb(90_40_10/0.5)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-gold/50 hover:shadow-[0_16px_30px_-16px_var(--gold)]"
              >
                {/* The artwork leans out over the card's top edge. */}
                <span className="pointer-events-none absolute -top-8 right-1 h-20 w-24 transition-transform duration-300 ease-out group-hover:-translate-y-1 group-hover:rotate-[-3deg] lg:-top-9 lg:h-24 lg:w-28">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element -- optional artwork of unknown size
                    <img src={image} alt="" className="h-full w-full object-contain drop-shadow-[0_8px_10px_rgb(90_40_10/0.28)]" />
                  ) : (
                    <Art />
                  )}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="mb-1 h-6 w-6">
                  <path d={f.icon} />
                </svg>
                <span className="font-semibold">{f.title}</span>
                <span className="text-sm text-muted">{f.detail}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
