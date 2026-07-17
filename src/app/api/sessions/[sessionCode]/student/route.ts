import {
  getActivePoll,
  getPollResponse,
  getSession,
  type ParticipantPoll,
} from "@/lib/qwt-store";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/student">,
) {
  const { sessionCode } = await ctx.params;
  const [session, poll] = await Promise.all([
    getSession(sessionCode),
    getActivePoll(sessionCode).catch(() => null),
  ]);

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const participantId = new URL(request.url).searchParams.get("participantId") ?? "";
  let activePoll: ParticipantPoll | null = poll
    ? { ...poll, selectedOptionIds: [] }
    : null;

  if (poll && participantId) {
    try {
      const response = await getPollResponse(poll.id, participantId);
      activePoll = {
        ...poll,
        selectedOptionIds: response?.optionIds ?? [],
      };
    } catch {
      activePoll = { ...poll, selectedOptionIds: [] };
    }
  }

  return Response.json({
    activePoll,
    session: {
      code: session.code,
      isOpen: session.isOpen,
      prompt: session.prompt,
      timerDurationSeconds: session.timerDurationSeconds,
      timerEndsAt: session.timerEndsAt,
    },
  });
}
