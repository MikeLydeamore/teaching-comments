import { setGroupQuestionAnswered } from "@/lib/qwt-store";
import { isTeacherAuthenticated, teacherUnauthorizedResponse } from "@/lib/teacher-auth";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]">,
) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { isAnswered?: boolean };

  if (typeof body.isAnswered !== "boolean") {
    return Response.json({ error: "Answered state is required." }, { status: 400 });
  }

  const question = await setGroupQuestionAnswered(id, body.isAnswered);

  if (!question) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  return Response.json({ question });
}
