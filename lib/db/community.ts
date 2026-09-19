import "server-only";
import postgres from "postgres";

// Discovery directory (docs/spec.md §2.5, phase 1): read-only, opt-in, and no
// messaging. Members are matched on language pair, county and interest tags —
// nothing behavioural is collected.
//
// Storage follows lib/db/contributions.ts: Postgres when DATABASE_URL is set,
// otherwise an in-memory list for local development.

export const interestTags = ["Music", "Food", "History", "Proverbs", "Literature", "Storytelling", "Names", "Crafts"];

export type Member = {
  userId: string;
  displayName: string;
  avatar: string;
  county?: string;
  speaks: string[];
  learning: string[];
  interests: string[];
};

const sql = process.env.DATABASE_URL ? postgres(process.env.DATABASE_URL, { prepare: false }) : undefined;
const memory = new Map<string, Member>();

const regionId = (county?: string) => county?.toLowerCase().replace(/[^a-z]+/g, "-") ?? null;

export async function joinDirectory(member: Member): Promise<void> {
  if (!sql) {
    memory.set(member.userId, member);
    return;
  }
  await sql`
    insert into onboarding_profiles (user_id, display_name, avatar, county)
    values (${member.userId}, ${member.displayName}, ${member.avatar}, ${regionId(member.county)})
    on conflict (user_id) do update set display_name = excluded.display_name, avatar = excluded.avatar, county = excluded.county`;
  await sql`
    insert into community_profiles (user_id, speaks_languages, learning_languages, county, interests, directory_opt_in)
    values (${member.userId}, ${member.speaks}, ${member.learning}, ${regionId(member.county)}, ${member.interests}, true)
    on conflict (user_id) do update set
      speaks_languages = excluded.speaks_languages,
      learning_languages = excluded.learning_languages,
      county = excluded.county,
      interests = excluded.interests,
      directory_opt_in = true`;
}

export async function leaveDirectory(userId: string): Promise<void> {
  if (!sql) {
    memory.delete(userId);
    return;
  }
  await sql`update community_profiles set directory_opt_in = false where user_id = ${userId}`;
}

export async function listMembers(): Promise<Member[]> {
  if (!sql) return [...memory.values()];
  const rows = await sql`
    select c.user_id, o.display_name, o.avatar, r.name as county,
           c.speaks_languages, c.learning_languages, c.interests
    from community_profiles c
    join onboarding_profiles o using (user_id)
    left join regions r on r.id = c.county
    where c.directory_opt_in
    limit 200`;
  return rows.map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatar: r.avatar ?? "ocean",
    county: r.county ?? undefined,
    speaks: r.speaks_languages,
    learning: r.learning_languages,
    interests: r.interests,
  }));
}

/** Higher is a closer match. Language pairs count most, then county, then interests. */
export function matchScore(me: Member, other: Member): number {
  const shared = (a: string[], b: string[]) => a.filter((x) => b.includes(x)).length;
  return (
    shared(me.learning, other.speaks) * 3 +
    shared(me.speaks, other.learning) * 3 +
    shared(me.learning, other.learning) * 2 +
    (me.county && me.county === other.county ? 2 : 0) +
    shared(me.interests, other.interests)
  );
}
