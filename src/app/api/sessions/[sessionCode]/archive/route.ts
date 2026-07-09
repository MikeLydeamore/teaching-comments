import {
  archiveSessionActivity,
  getSessionStats,
  unarchiveSessionActivity,
} from "@/lib/qwt-store";
import { isTeacherAuthenticated, teacherUnauthorizedResponse } from "@/lib/teacher-auth";

export async function POST(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/archive">,
) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { sessionCode } = await ctx.params;
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
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { sessionCode } = await ctx.params;
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
