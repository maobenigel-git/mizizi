import type { NextRequest } from "next/server";
import { listArticles, relatedBooks } from "@/lib/db/culture";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/languages/[id]/culture">) {
  const { id } = await ctx.params;
  const [articles, books] = await Promise.all([listArticles(id), relatedBooks(id)]);
  return Response.json({ articles, books });
}
