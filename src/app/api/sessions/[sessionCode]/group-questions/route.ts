import { addGroupQuestion, listGroupQuestions } from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/group-questions">,
) {
  const { sessionCode } = await ctx.params;
  const url = new URL(request.url);
  const voterId = url.searchParams.get("voterId") ?? undefined;
  const wantsAnswered = url.searchParams.get("includeAnswered") === "true";
  const wantsHidden = url.searchParams.get("includeHidden") === "true";
  const authorization = wantsAnswered || wantsHidden
    ? await getAuthorizedTeacherSession(sessionCode)
    : null;
  const includeAnswered = Boolean(wantsAnswered && !authorization?.response);
  const includeHidden = Boolean(wantsHidden && !authorization?.response);

  try {
    const questions = await listGroupQuestions(sessionCode, voterId, {
      includeAnswered,
      includeHidden,
    });
    return Response.json({ questions });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not load questions." },
      { status: 400 },
    );
  }
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/group-questions">,
) {
  const { sessionCode } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    studentName?: string;
    text?: string;
    website?: string;
  };

  try {
    if (body.website) {
      return Response.json({ error: "Could not save question." }, { status: 400 });
    }

    const question = await addGroupQuestion(
      sessionCode,
      body.text ?? "",
      body.studentName,
    );

    if (!question) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    return Response.json({ question }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save question." },
      { status: 400 },
    );
  }
}
