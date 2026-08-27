import { updateSubmissionViewSettings } from "@/lib/edie-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";
import { getSubmissionViewPayload } from "@/lib/submission-view";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submission-view">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const includeHidden =
    new URL(request.url).searchParams.get("includeHidden") === "true";
  const payload = await getSubmissionViewPayload(
    authorization.session,
    includeHidden,
  );
  return Response.json(payload);
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submission-view">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const body = await request.json().catch(() => null);

  try {
    const viewSettings = await updateSubmissionViewSettings(sessionCode, body);

    if (!viewSettings) {
      return Response.json({ error: "Session not found." }, { status: 404 });
    }

    return Response.json({ viewSettings });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update display settings.",
      },
      { status: 400 },
    );
  }
}
