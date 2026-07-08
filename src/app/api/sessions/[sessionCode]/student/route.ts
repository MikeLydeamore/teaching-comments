import { getSession } from "@/lib/qwt-store";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/student">,
) {
  const { sessionCode } = await ctx.params;
  const session = await getSession(sessionCode);

  if (!session) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  return Response.json({
    session: {
      code: session.code,
      isOpen: session.isOpen,
      prompt: session.prompt,
      timerDurationSeconds: session.timerDurationSeconds,
      timerEndsAt: session.timerEndsAt,
    },
  });
}
