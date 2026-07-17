import { endPoll, extendPoll, getPoll, getPollResults } from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/polls/[id]">,
) {
  const { id } = await ctx.params;
  const currentPoll = await getPoll(id);

  if (!currentPoll) {
    return Response.json({ error: "Poll not found." }, { status: 404 });
  }

  const authorization = await getAuthorizedTeacherSession(currentPoll.sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "end" | "extend";
    seconds?: number;
  };

  try {
    const poll =
      body.action === "end"
        ? await endPoll(id)
        : body.action === "extend"
          ? await extendPoll(id, Number(body.seconds))
          : null;

    if (!poll) {
      return Response.json(
        { error: body.action ? "Poll not found." : "Choose a poll action." },
        { status: body.action ? 404 : 400 },
      );
    }

    const results = await getPollResults(poll.id);
    return Response.json({ poll, results });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update poll." },
      { status: 400 },
    );
  }
}
