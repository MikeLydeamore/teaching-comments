import { cookies } from "next/headers";
import { addSubmission, listSubmissions } from "@/lib/qwt-store";
import { studentConsentCookieName } from "@/lib/student-consent-cookie";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submissions">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const url = new URL(request.url);
  const minutesParam = url.searchParams.get("minutes");
  const minutes = minutesParam ? Number(minutesParam) : undefined;
  const includeHidden = url.searchParams.get("includeHidden") === "true";
  const promptHistoryId = url.searchParams.get("promptHistoryId") || undefined;
  const submissions = await listSubmissions(sessionCode, {
    minutes: Number.isFinite(minutes) ? minutes : undefined,
    includeHidden,
    promptHistoryId,
  });

  return Response.json({ submissions });
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submissions">,
) {
  const { sessionCode } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as {
    drawingData?: unknown;
    gifData?: unknown;
    studentName?: string;
    text?: string;
    website?: string;
  };

  try {
    if (body.website) {
      return Response.json({ error: "Could not save submission." }, { status: 400 });
    }

    const cookieStore = await cookies();

    if (cookieStore.get(studentConsentCookieName(sessionCode))?.value !== "accepted") {
      return Response.json(
        { error: "Please join the session and acknowledge the privacy notice first." },
        { status: 403 },
      );
    }

    const submission = await addSubmission(
      sessionCode,
      body.text ?? "",
      body.drawingData,
      body.gifData,
      body.studentName,
    );
    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save submission." },
      { status: 400 },
    );
  }
}
