import { deletePollQuestionFromBank } from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/poll-questions/[id]">,
) {
  const { id, sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const deleted = await deletePollQuestionFromBank(
    authorization.session.id,
    id,
  );

  if (!deleted) {
    return Response.json(
      { error: "Poll question not found." },
      { status: 404 },
    );
  }

  return Response.json({ ok: true });
}
