import { deleteQuestionFromBank } from "@/lib/qwt-store";
import {
  isAnyTeacherAuthenticated,
  teacherUnauthorizedResponse,
} from "@/lib/teacher-session-auth";

export async function DELETE(_request: Request, ctx: RouteContext<"/api/questions/[id]">) {
  if (!(await isAnyTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { id } = await ctx.params;
  const deleted = await deleteQuestionFromBank(id);

  if (!deleted) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  return Response.json({ ok: true });
}
