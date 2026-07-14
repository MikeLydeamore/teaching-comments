import {
  setGroupQuestionAnswered,
  setGroupQuestionVisible,
} from "@/lib/qwt-store";
import {
  isAnyTeacherAuthenticated,
  teacherUnauthorizedResponse,
} from "@/lib/teacher-session-auth";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]">,
) {
  if (!(await isAnyTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    isAnswered?: boolean;
    isVisible?: boolean;
  };

  if (
    typeof body.isAnswered !== "boolean" &&
    typeof body.isVisible !== "boolean"
  ) {
    return Response.json(
      { error: "Answered or visibility state is required." },
      { status: 400 },
    );
  }

  let question = null;

  if (typeof body.isAnswered === "boolean") {
    question = await setGroupQuestionAnswered(id, body.isAnswered);
  }

  if (typeof body.isVisible === "boolean") {
    question = await setGroupQuestionVisible(id, body.isVisible);
  }

  if (!question) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  return Response.json({ question });
}
