import type { NextRequest } from "next/server";
import { search } from "@/lib/search";

export async function GET(request: NextRequest) {
  return Response.json(await search(request.nextUrl.searchParams.get("q") ?? ""));
}
