import { getLanguage } from "@/lib/db/languages";
import { learnerPath } from "@/lib/lessons/progress";
import { getSession } from "@/lib/session";

/*
 * GET /api/courses/{languageId}/path?from=1&limit=40
 *
 * One page of the learner's path: each level's number, title, summary,
 * exercise kinds and state (completed | current | open | locked), plus the
 * totals. The Lessons screen loads the pages around the learner's current
 * level and fetches more as they scroll, so a 1,000-level course never renders
 * 1,000 nodes at once.
 */

const MAX_LIMIT = 100;

export async function GET(request: Request, { params }: RouteContext<"/api/courses/[languageId]/path">) {
  const { languageId } = await params;
  if (!(await getLanguage(languageId))) return Response.json({ error: "unknown_language" }, { status: 404 });

  const search = new URL(request.url).searchParams;
  const from = Math.max(1, Number(search.get("from")) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(search.get("limit")) || 40));

  const path = await learnerPath(await getSession(), languageId);
  return Response.json({
    total: path.total,
    current: path.current,
    completedCount: path.completedCount,
    from,
    levels: path.levels.slice(from - 1, from - 1 + limit),
  });
}
