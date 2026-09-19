import type { NextRequest } from "next/server";
import { listVocabulary } from "@/lib/db/vocabulary";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]/vocabulary">) {
  const { id } = await ctx.params;
  return Response.json(await listVocabulary(id));
}
