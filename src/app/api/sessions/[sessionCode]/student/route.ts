import {
  getActivePoll,
  getPollResponse,
  getSession,
  type ParticipantPoll,
} from "@/lib/edie-store";
import { admitParticipant } from "@/lib/participant-admission";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/student">,
) {
  const { sessionCode } = await ctx.params;
  const session = await getSession(sessionCode);

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const searchParams = new URL(request.url).searchParams;
  const participantId = searchParams.get("participantId") ?? "";
  let admission = null;

  if (searchParams.get("presence") === "1") {
    try {
      admission = await admitParticipant(session, participantId);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "A valid participant identifier is required." },
        { status: 400 },
      );
    }

    if (admission.status === "full") {
      return Response.json({
        admission,
        session: { isOpen: session.isOpen },
      });
    }
  }

  const poll = await getActivePoll(sessionCode).catch(() => null);
  const availablePoll = session.isOpen ? poll : null;
  const participantPoll = availablePoll
    ? {
        ...availablePoll,
        solutionRevealed:
          availablePoll.solutionRevealed ||
          availablePoll.votingEndedAt !== null ||
          new Date(availablePoll.endsAt).getTime() <= Date.now(),
        correctOptionIds:
          availablePoll.solutionRevealed ||
          availablePoll.votingEndedAt !== null ||
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
    admission,
    session: {
      code: session.code,
      isOpen: session.isOpen,
      prompt: session.prompt,
      textInputEnabled: session.textInputEnabled,
      gifInputEnabled: session.gifInputEnabled,
      drawingInputEnabled: session.drawingInputEnabled,
      imageInputEnabled: session.imageInputEnabled,
      imageEmbedsEnabled: session.imageEmbedsEnabled,
      timerDurationSeconds: session.timerDurationSeconds,
      timerEndsAt: session.timerEndsAt,
    },
  });
}
