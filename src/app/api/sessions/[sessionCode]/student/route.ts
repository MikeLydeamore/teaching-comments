import {
  getActivePoll,
  getPollResponse,
  getSession,
  type ParticipantPoll,
} from "@/lib/edie-store";

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
  const participantPoll = availablePoll
    ? {
        ...availablePoll,
        solutionRevealed:
          availablePoll.solutionRevealed ||
          new Date(availablePoll.endsAt).getTime() <= Date.now(),
        correctOptionIds:
          availablePoll.solutionRevealed ||
          new Date(availablePoll.endsAt).getTime() <= Date.now()
            ? availablePoll.correctOptionIds
            : [],
      }
    : null;
  let activePoll: ParticipantPoll | null = participantPoll
    ? { ...participantPoll, selectedOptionIds: [] }
    : null;

  if (participantPoll && participantId) {
    try {
      const response = await getPollResponse(participantPoll.id, participantId);
      activePoll = {
        ...participantPoll,
        selectedOptionIds: response?.optionIds ?? [],
      };
    } catch {
      activePoll = { ...participantPoll, selectedOptionIds: [] };
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
