import {
  deletePollQuestionFromBank,
  type PollSelectionMode,
  updatePollQuestionInBank,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/poll-questions/[id]">,
) {
  const { id, sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    correctOptionIndexes?: unknown[];
    options?: unknown[];
    question?: string;
    selectionMode?: PollSelectionMode;
  };

  try {
    const bankQuestion = await updatePollQuestionInBank(
      authorization.session.id,
      id,
      String(body.question ?? ""),
      body.selectionMode ?? "single",
      Array.isArray(body.options) ? body.options.map(String) : [],
      Array.isArray(body.correctOptionIndexes)
        ? body.correctOptionIndexes.map(Number)
        : [],
    );

    if (!bankQuestion) {
      return Response.json(
        { error: "Poll question not found." },
        { status: 404 },
      );
    }

    return Response.json({ bankQuestion });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update poll question.",
      },
      { status: 400 },
    );
  }
}

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
