import type { Metadata } from "next";
import Link from "next/link";
import { listCommunities } from "@/lib/db/culture";
import { listFamilies } from "@/lib/db/languages";

export const metadata: Metadata = { title: "Culture & heritage · Mizizi" };

export default async function CulturePage() {
  const [communities, families] = await Promise.all([listCommunities(), listFamilies()]);
  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/explore" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Explore
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Culture &amp; heritage</h1>
        <p className="max-w-2xl text-muted">
          Each community&apos;s traditions in its own right. Articles are published only with a cited source and
          community validation.
        </p>
      </header>
      {families.map((family) => {
        const members = communities.filter((c) => c.family === family.id);
        if (members.length === 0) return null;
        return (
          <section key={family.id} className="space-y-3">
            <h2 className="text-sm font-medium text-muted">{family.name}</h2>
            <ul className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {members.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/culture/${c.id}`}
                    className="glass !rounded-xl block px-4 py-3 font-medium transition-colors duration-200 ease-out hover:border-accent"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
