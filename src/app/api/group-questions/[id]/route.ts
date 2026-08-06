import {
  getGroupQuestion,
  setGroupQuestionAnswered,
  setGroupQuestionVisible,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]">,
) {
  const { id } = await ctx.params;
  const currentQuestion = await getGroupQuestion(id);

  if (!currentQuestion) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  const authorization = await getAuthorizedTeacherSession(
    currentQuestion.sessionCode,
  );

  if (authorization.response) {
    return authorization.response;
  }

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
    question = await setGroupQuestionAnswered(
      currentQuestion.sessionCode,
      id,
      body.isAnswered,
    );
  }

  if (typeof body.isVisible === "boolean") {
    question = await setGroupQuestionVisible(
      currentQuestion.sessionCode,
      id,
      body.isVisible,
    );
  }

  if (!question) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }

  return Response.json({ question });
}
