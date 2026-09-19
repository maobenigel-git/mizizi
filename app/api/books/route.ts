import { listBooks } from "@/lib/db/library";

export async function GET() {
  return Response.json(await listBooks());
}
