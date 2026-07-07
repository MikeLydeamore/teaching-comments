import { getOrCreateSession, getSessionStats, updateSession } from "@/lib/qwt-store";
import { isTeacherAuthenticated, teacherUnauthorizedResponse } from "@/lib/teacher-auth";

export async function GET(_request: Request, ctx: RouteContext<"/api/sessions/[sessionCode]">) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { sessionCode } = await ctx.params;
  const session = await getOrCreateSession(sessionCode);
  const stats = await getSessionStats(session.code);

  return Response.json({ session, stats });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]">,
) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { sessionCode } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    isOpen?: boolean;
    prompt?: string;
    title?: string;
  };

  try {
    const session = await updateSession(sessionCode, {
      isOpen: body.isOpen,
      prompt: body.prompt,
      title: body.title,
    });

    if (!session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    const stats = await getSessionStats(session.code);
    return Response.json({ session, stats });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update session." },
      { status: 400 },
    );
  }
}
