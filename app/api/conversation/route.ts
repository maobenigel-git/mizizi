import { cookies } from "next/headers";
import { allowRequest } from "@/lib/ai/rate-limit";
import { tutorReply, type TutorTurn } from "@/lib/ai/tutor";
import { getSession } from "@/lib/session";
import { COOKIE_COMPLETED, SKIP_ONBOARDING } from "@/lib/session/types";

const MAX_MESSAGE_LENGTH = 1000;

export async function POST(request: Request) {
  // Only onboarded learners can spend tutor tokens. The proxy lets the screens
  // through under DEV_SKIP_ONBOARDING, so this check honours it too — otherwise
  // the Tutor tab renders but every message 401s.
  if (!SKIP_ONBOARDING && (await cookies()).get(COOKIE_COMPLETED)?.value !== "true") {
    return Response.json({ status: "unauthorized", message: "Finish onboarding first." }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  const messages: TutorTurn[] = Array.isArray(body?.messages)
    ? body.messages
        .filter((m: TutorTurn) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
        .map((m: TutorTurn) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }))
    : [];
  if (messages.length === 0 || messages[messages.length - 1].role !== "user") {
    return Response.json({ status: "bad_request", message: "Send at least one user message." }, { status: 400 });
  }

  const session = await getSession();
  if (!session.languageId) {
    return Response.json({ status: "bad_request", message: "Choose a language first." }, { status: 400 });
  }
  const caller = session.userId ?? request.headers.get("x-forwarded-for") ?? "anonymous";
  if (!allowRequest(caller)) {
    return Response.json({ status: "unavailable", message: "You have reached the hourly tutor limit. Try again later." }, { status: 429 });
  }
  const reply = await tutorReply(session.languageId, session.level, messages);
  return Response.json(reply, { status: reply.status === "ok" ? 200 : reply.status === "not_configured" ? 503 : 502 });
}
