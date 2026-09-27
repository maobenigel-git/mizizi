import { getLevel, toClient } from "@/lib/lessons/levels";

/*
 * Lessons are generated deterministically from verified data, never free-form
 * by a model. Returns one level with its exercises — without their answers,
 * which only the server grades against (lib/lessons/actions).
 *   { languageId, level?: number }
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.languageId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  const level = await getLevel(body.languageId, Number(body.level) || 1);
  if (!level) return Response.json({ error: "unknown_level" }, { status: 404 });
  return Response.json({ ...level, exercises: level.exercises.map(toClient) });
}
