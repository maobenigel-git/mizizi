import type { NextRequest } from "next/server";
import { getCourse } from "@/lib/lessons/orientation";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]/lessons">) {
  const { id } = await ctx.params;
  return Response.json(getCourse(id).map(({ id, slug, title, summary }) => ({ id, slug, title, summary })));
}
