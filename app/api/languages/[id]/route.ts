import type { NextRequest } from "next/server";
import { getLanguage } from "@/lib/db/languages";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]">) {
  const { id } = await ctx.params;
  const language = await getLanguage(id);
  if (!language) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  return Response.json(language);
}
