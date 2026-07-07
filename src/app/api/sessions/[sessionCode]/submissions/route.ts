import { addSubmission, listSubmissions } from "@/lib/qwt-store";
import { isTeacherAuthenticated, teacherUnauthorizedResponse } from "@/lib/teacher-auth";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submissions">,
) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { sessionCode } = await ctx.params;
  const url = new URL(request.url);
  const minutesParam = url.searchParams.get("minutes");
  const minutes = minutesParam ? Number(minutesParam) : undefined;
  const includeHidden = url.searchParams.get("includeHidden") === "true";
  const submissions = await listSubmissions(sessionCode, {
    minutes: Number.isFinite(minutes) ? minutes : undefined,
    includeHidden,
  });

  return Response.json({ submissions });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submissions">,
) {
  const { sessionCode } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    privacyAccepted?: boolean;
    text?: string;
    website?: string;
  };

  try {
    if (body.website) {
      return Response.json({ error: "Could not save submission." }, { status: 400 });
    }

    if (!body.privacyAccepted) {
      return Response.json(
        { error: "Please acknowledge the privacy notice before submitting." },
        { status: 400 },
      );
    }

    const submission = await addSubmission(sessionCode, body.text ?? "");
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save submission." },
      { status: 400 },
    );
  }
}
