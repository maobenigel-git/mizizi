import type { NextRequest } from "next/server";
import { listVocabulary } from "@/lib/db/vocabulary";

/** Licensed native-speaker recordings only; empty until corpus audio is imported. */
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]/audio">) {
  const { id } = await ctx.params;
  const words = await listVocabulary(id);
  return Response.json(words.filter((w) => w.audioUrl).map((w) => ({ wordId: w.id, term: w.term, url: w.audioUrl })));
}
