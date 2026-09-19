import Link from "next/link";

// Every destination in the app, in one place. Learning features carry the
// ocean accent and culture / community features the earth accent, matching the
// sections they lead to.

const features = [
  { href: "/learn", title: "Lessons", detail: "Follow your learning path", tone: "ocean", icon: "M12 6.5c-2-1.3-4.5-2-7.5-2v13c3 0 5.5.7 7.5 2m0-13c2-1.3 4.5-2 7.5-2v13c-3 0-5.5.7-7.5 2m0-13v13" },
  { href: "/practice", title: "AI tutor", detail: "Practise in conversation", tone: "ocean", icon: "M21 12a8 8 0 0 1-11.8 7L4 20l1.1-4.4A8 8 0 1 1 21 12Z" },
  { href: "/translate", title: "Translate", detail: "Between Kenyan languages", tone: "ocean", icon: "M4 6h9M8.5 4v2m3 0c-.6 3.4-3 6.4-7 8m2.5-5c1 2 2.7 3.6 5 4.7M13 20l4-9 4 9m-6.7-3h5.4" },
  { href: "/notebook", title: "Notebook", detail: "Review your saved words", tone: "ocean", icon: "M6 4h12v17l-6-4-6 4V4Z" },
  { href: "/languages", title: "Languages", detail: "Browse the full catalogue", tone: "earth", icon: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9ZM3.5 9h17m-17 6h17" },
  { href: "/culture", title: "Culture", detail: "Traditions and heritage", tone: "earth", icon: "M12 3 3 8v2h18V8l-9-5ZM5 10v8m4.7-8v8m4.6-8v8M19 10v8M3 21h18v-3H3v3Z" },
  { href: "/literature", title: "Literature", detail: "Kenyan books and authors", tone: "earth", icon: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Zm0 13a3 3 0 0 1 3-3h10M9 8h5" },
  { href: "/community", title: "Community", detail: "Meet people and contribute", tone: "earth", icon: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0M16 4.5a3.5 3.5 0 0 1 0 6.5m2 9a6 6 0 0 0-3-5.2" },
] as const;

const tones = {
  ocean: "text-ocean group-hover:border-ocean",
  earth: "text-earth group-hover:border-earth",
};

export function FeatureGrid() {
  return (
    <nav aria-label="All features" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {features.map((f) => (
        <Link key={f.href} href={f.href} className="group">
          <span className={`flex h-full flex-col gap-2 rounded-2xl border-2 border-border bg-surface p-4 transition-colors duration-200 ease-out ${tones[f.tone]}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="h-7 w-7">
              <path d={f.icon} />
            </svg>
            <span className="font-semibold text-foreground">{f.title}</span>
            <span className="text-sm text-muted">{f.detail}</span>
          </span>
        </Link>
      ))}
    </nav>
  );
}
