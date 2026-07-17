import {
  getLatestPoll,
  getPollResults,
  startPoll,
  type PollSelectionMode,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/polls">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const poll = await getLatestPoll(authorization.session.code);
  const results = poll ? await getPollResults(poll.id) : null;
  return Response.json({ poll, results });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/polls">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    durationSeconds?: number;
    options?: unknown[];
    question?: string;
    selectionMode?: PollSelectionMode;
  };

  try {
    const poll = await startPoll(
      authorization.session.code,
      String(body.question ?? ""),
      body.selectionMode ?? "single",
      Array.isArray(body.options) ? body.options.map(String) : [],
      Number(body.durationSeconds),
    );

    if (!poll) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    const results = await getPollResults(poll.id);
    return Response.json({ poll, results }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not start poll." },
      { status: 400 },
    );
  }
}
