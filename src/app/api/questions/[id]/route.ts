import { deleteQuestionFromBank, getQuestionFromBank } from "@/lib/edie-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/questions/[id]">) {
  const { id } = await ctx.params;
  const question = await getQuestionFromBank(id);

  if (!question) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  const authorization = await getAuthorizedTeacherSession(question.sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const deleted = await deleteQuestionFromBank(question.sessionCode, id);

  if (!deleted) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
