import type { NextRequest } from "next/server";
import { getBook } from "@/lib/db/library";

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/books/[id]">) {
  const book = await getBook((await ctx.params).id);
  return book ? Response.json(book) : Response.json({ error: "not_found" }, { status: 404 });
}
