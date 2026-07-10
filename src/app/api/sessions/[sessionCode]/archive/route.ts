import {
  archiveSessionActivity,
  getSessionStats,
  unarchiveSessionActivity,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/archive">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const result = await archiveSessionActivity(sessionCode);

  if (!result) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const stats = await getSessionStats(sessionCode);
  return Response.json({ archive: result, stats });
}

export async function DELETE(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/archive">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = (await request.json().catch(() => ({}))) as {
    archivedAt?: unknown;
  };
  const archivedAt = typeof body.archivedAt === "string" ? body.archivedAt : "";
  const archiveDate = new Date(archivedAt);

  if (!archivedAt || !Number.isFinite(archiveDate.getTime())) {
    return Response.json(
      { error: "Archive timestamp could not be read." },
      { status: 400 },
    );
  }

  const result = await unarchiveSessionActivity(sessionCode, archivedAt);

  if (!result) {
    return Response.json({ error: "Session not found." }, { status: 404 });
  }

  const stats = await getSessionStats(sessionCode);
  return Response.json({ archive: result, stats });
}
