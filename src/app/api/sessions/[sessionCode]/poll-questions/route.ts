import {
  addPollQuestionToBank,
  listPollQuestionBank,
  type PollSelectionMode,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/poll-questions">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const pollQuestionBank = await listPollQuestionBank(
    authorization.session.id,
  );
  return Response.json({ pollQuestionBank });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/poll-questions">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    options?: unknown[];
    correctOptionIndexes?: unknown[];
    question?: string;
    selectionMode?: PollSelectionMode;
    title?: string;
  };

  try {
    const bankQuestion = await addPollQuestionToBank(
      authorization.session.id,
      String(body.title ?? ""),
      String(body.question ?? ""),
      body.selectionMode ?? "single",
      Array.isArray(body.options) ? body.options.map(String) : [],
      Array.isArray(body.correctOptionIndexes)
        ? body.correctOptionIndexes.map(Number)
        : [],
    );

    if (!bankQuestion) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    return Response.json({ bankQuestion }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not add poll question.",
      },
      { status: 400 },
    );
  }
}
