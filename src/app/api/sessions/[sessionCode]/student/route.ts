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
  const availablePoll = session.isOpen ? poll : null;
  let activePoll: ParticipantPoll | null = availablePoll
    ? { ...availablePoll, selectedOptionIds: [] }
    : null;

  if (availablePoll && participantId) {
    try {
      const response = await getPollResponse(availablePoll.id, participantId);
      activePoll = {
        ...availablePoll,
        selectedOptionIds: response?.optionIds ?? [],
      };
    } catch {
      activePoll = { ...availablePoll, selectedOptionIds: [] };
    }
  }

  return Response.json({
    activePoll,
    session: {
      code: session.code,
      isOpen: session.isOpen,
      prompt: session.prompt,
      textInputEnabled: session.textInputEnabled,
      gifInputEnabled: session.gifInputEnabled,
      drawingInputEnabled: session.drawingInputEnabled,
      imageInputEnabled: session.imageInputEnabled,
      timerDurationSeconds: session.timerDurationSeconds,
      timerEndsAt: session.timerEndsAt,
    },
  });
}
