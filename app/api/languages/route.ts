import { listLanguages } from "@/lib/db/languages";

export async function GET() {
  return Response.json(await listLanguages());
}
