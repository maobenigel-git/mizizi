import { getCourse } from "@/lib/lessons/orientation";

/** Lessons are generated deterministically from verified data, never free-form by a model. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const course = typeof body?.languageId === "string" ? getCourse(body.languageId) : [];
  if (course.length === 0) return Response.json({ error: "unknown_language" }, { status: 404 });
  const lesson = course.find((l) => l.slug === body.slug) ?? course[0];
  return Response.json(lesson);
}
