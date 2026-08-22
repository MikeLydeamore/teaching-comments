import { getPollHistory } from "@/lib/edie-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/polls/history">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const history = await getPollHistory(authorization.session.id);

  return Response.json({ history });
}
