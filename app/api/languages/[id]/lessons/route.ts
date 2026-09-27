import type { NextRequest } from "next/server";
import { listLevels } from "@/lib/lessons/levels";

/** The course's levels, in order: number, title, summary and exercise kinds. No answers. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]/lessons">) {
  const { id } = await ctx.params;
  return Response.json(await listLevels(id));
}
