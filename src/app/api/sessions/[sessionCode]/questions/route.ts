import { addQuestionToBank, listQuestionBank } from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/questions">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const questionBank = await listQuestionBank(sessionCode);

  return Response.json({ questionBank });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/questions">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    text?: string;
    title?: string;
  };

  try {
    const question = await addQuestionToBank(
      sessionCode,
      body.text ?? "",
      body.title,
    );

    if (!question) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    return Response.json({ question }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not add question." },
      { status: 400 },
    );
  }
}
