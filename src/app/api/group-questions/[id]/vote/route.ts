import { getGroupQuestion, getSession, unvoteGroupQuestion, upvoteGroupQuestion } from "@/lib/edie-store";
import { requireParticipantAdmission } from "@/lib/participant-admission";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

async function questionIsAvailable(id: string) {
  const question = await getGroupQuestion(id);
  if (!question) return null;
  const session = await getSession(question.sessionCode);
  return session ? { question, session } : null;
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]/vote">,
) {
  const { id } = await ctx.params;
  const available = await questionIsAvailable(id);
  if (!available) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { participantId?: string; voterId?: string };

  try {
    const authorization = await getAuthorizedTeacherSession(available.session.id);
    if (authorization.response) {
      const capacityResponse = await requireParticipantAdmission(available.session, String(body.participantId ?? ""));
      if (capacityResponse) return capacityResponse;
    }
    const question = await upvoteGroupQuestion(id, body.voterId ?? "");

    if (!question) {
      return Response.json({ error: "Question not found." }, { status: 404 });
    }

    return Response.json({ question });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save vote." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]/vote">,
) {
  const { id } = await ctx.params;
  const available = await questionIsAvailable(id);
  if (!available) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { participantId?: string; voterId?: string };

  try {
    const authorization = await getAuthorizedTeacherSession(available.session.id);
    if (authorization.response) {
      const capacityResponse = await requireParticipantAdmission(available.session, String(body.participantId ?? ""));
      if (capacityResponse) return capacityResponse;
    }
    const question = await unvoteGroupQuestion(id, body.voterId ?? "");

    if (!question) {
      return Response.json({ error: "Question not found." }, { status: 404 });
    }

    return Response.json({ question });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not remove vote." },
      { status: 400 },
    );
  }
}
