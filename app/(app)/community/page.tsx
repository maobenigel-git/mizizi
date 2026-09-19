import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/shell/Avatar";
import { interestTags, listMembers, matchScore, type Member } from "@/lib/db/community";
import { listLanguages } from "@/lib/db/languages";
import { getSession } from "@/lib/session";
import { joinCommunity, leaveCommunity } from "@/lib/session/actions";
import type { AvatarColor } from "@/lib/session/types";

export const metadata: Metadata = { title: "Community · Mizizi" };

export default async function CommunityPage() {
  const [session, languages, members] = await Promise.all([getSession(), listLanguages(), listMembers()]);
  const nameOf = (id: string) => languages.find((l) => l.id === id)?.name ?? id;

  const me: Member = {
    userId: session.userId ?? "",
    displayName: session.displayName,
    avatar: session.avatar,
    county: session.county,
    speaks: session.speaks ? [session.speaks] : [],
    learning: session.languageId ? [session.languageId] : [],
    interests: session.interests,
  };
  const others = members
    .filter((m) => m.userId !== me.userId)
    .map((m) => ({ member: m, score: matchScore(me, m) }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <Link href="/explore" transitionTypes={["nav-back"]} className="text-sm text-accent hover:underline">
          ← Explore
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Community</h1>
        <p className="max-w-2xl text-muted">
          Find people learning or speaking your language. The directory is read-only: there is no messaging, and you
          are only listed if you choose to be.
        </p>
      </header>

      <Link
        href="/community/contribute"
        className="flex items-center justify-between gap-4 rounded-2xl bg-accent-solid p-6 text-white transition-opacity duration-200 ease-out hover:opacity-95"
      >
        <span>
          <span className="block text-xl font-semibold">Help expand your language</span>
          <span className="block text-white/85">Translate a word, verify an entry, or share a proverb. Two minutes each.</span>
        </span>
        <span aria-hidden className="text-2xl">→</span>
      </Link>

      <section className="glass space-y-4 p-5">
        <h2 className="text-lg font-semibold">{session.inDirectory ? "Your listing" : "Join the directory"}</h2>
        <form action={joinCommunity} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">A language you already speak</span>
            <select name="speaks" defaultValue={session.speaks ?? ""} className="w-full rounded-xl border-2 border-border bg-background px-4 py-2.5 outline-none focus:border-accent">
              <option value="">Prefer not to say</option>
              {languages.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Interests</legend>
            <div className="flex flex-wrap gap-2">
              {interestTags.map((tag) => (
                <label key={tag} className="cursor-pointer">
                  <input type="checkbox" name="interests" value={tag} defaultChecked={session.interests.includes(tag)} className="peer sr-only" />
                  <span className="block rounded-full border border-border px-3 py-1 text-sm transition-colors duration-200 ease-out peer-checked:border-accent peer-checked:bg-accent/10 peer-checked:text-accent peer-focus-visible:border-accent">
                    {tag}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <p className="text-xs text-muted">
            Listing shows your display name, county, languages and interests to other members. Nothing else is shared.
          </p>
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="rounded-xl bg-accent-solid px-5 py-2.5 font-semibold text-white">
              {session.inDirectory ? "Update listing" : "List me in the directory"}
            </button>
            {session.inDirectory && (
              <button type="submit" formAction={leaveCommunity} className="rounded-xl border border-border px-5 py-2.5 text-muted hover:border-red hover:text-red">
                Remove my listing
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Members</h2>
        {others.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted">
            No other members are listed yet. Be one of the first.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {others.map(({ member, score }) => (
              <li key={member.userId} className="glass flex gap-3 p-4">
                <Avatar name={member.displayName} color={member.avatar as AvatarColor} />
                <div className="min-w-0 space-y-1 text-sm">
                  <p className="font-medium">
                    {member.displayName}
                    {score >= 3 && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs text-accent">Good match</span>}
                  </p>
                  {member.speaks.length > 0 && <p className="text-muted">Speaks {member.speaks.map(nameOf).join(", ")}</p>}
                  {member.learning.length > 0 && <p className="text-muted">Learning {member.learning.map(nameOf).join(", ")}</p>}
                  <p className="text-muted">{[member.county, ...member.interests].filter(Boolean).join(" · ")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
