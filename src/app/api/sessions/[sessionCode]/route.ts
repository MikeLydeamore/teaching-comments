import {
  getSessionStats,
  listPromptHistory,
  updateSession,
  type SessionPatch,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(_request: Request, ctx: RouteContext<"/api/sessions/[sessionCode]">) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const { session } = authorization;
  const stats = await getSessionStats(session.code);
  const promptHistory = await listPromptHistory(session.code);

  return Response.json({ promptHistory, session, stats });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    clearTimer?: boolean;
    groupQuestionsScreeningEnabled?: boolean;
    isOpen?: boolean;
    prompt?: string;
    timerDurationSeconds?: number;
    title?: string;
  };

  try {
    const patch: SessionPatch = {
      isOpen: body.isOpen,
      groupQuestionsScreeningEnabled: body.groupQuestionsScreeningEnabled,
      prompt: body.prompt,
      title: body.title,
    };

    if (body.clearTimer) {
      patch.timerDurationSeconds = 0;
      patch.timerEndsAt = null;
    } else if (typeof body.timerDurationSeconds === "number") {
      const durationSeconds = Math.round(body.timerDurationSeconds);

      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds < 1 ||
        durationSeconds > 3600
      ) {
        return Response.json(
          { error: "Timer must be between 1 and 3600 seconds." },
          { status: 400 },
        );
      }

      patch.timerDurationSeconds = durationSeconds;
      patch.timerEndsAt = new Date(Date.now() + durationSeconds * 1000).toISOString();
    }

    const session = await updateSession(sessionCode, patch);

    if (!session) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    const stats = await getSessionStats(session.code);
    const promptHistory = await listPromptHistory(session.code);
    return Response.json({ promptHistory, session, stats });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update session." },
      { status: 400 },
    );
  }
}
