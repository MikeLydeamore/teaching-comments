import {
  getActivePoll,
  getPollResponse,
  getSession,
  type ParticipantPoll,
} from "@/lib/edie-store";
import { recordSessionPresence } from "@/lib/submission-view-realtime";

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

  const searchParams = new URL(request.url).searchParams;
  const participantId = searchParams.get("participantId") ?? "";
  const presencePromise =
    searchParams.get("presence") === "1" && participantId
      ? recordSessionPresence(session.id, participantId)
      : Promise.resolve(false);
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

  await presencePromise;

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
      imageEmbedsEnabled: session.imageEmbedsEnabled,
      timerDurationSeconds: session.timerDurationSeconds,
      timerEndsAt: session.timerEndsAt,
    },
  });
}
