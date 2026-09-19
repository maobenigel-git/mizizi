import { translate } from "@/lib/translation";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { text, from, to } = body ?? {};
  if (typeof text !== "string" || typeof from !== "string" || typeof to !== "string") {
    return Response.json({ error: "expected { text, from, to }" }, { status: 400 });
  }
  const result = await translate(text.slice(0, 200), from, to);
  // Spec wording for the miss case, so clients never mistake it for a translation.
  return Response.json(result.text ? result : { ...result, error: "translation_unavailable" });
}
