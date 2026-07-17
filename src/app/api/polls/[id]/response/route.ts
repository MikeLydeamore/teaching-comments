import { cookies } from "next/headers";
import { getPoll, savePollResponse } from "@/lib/qwt-store";
import { studentConsentCookieName } from "@/lib/student-consent-cookie";

export async function PUT(
  request: Request,
  ctx: RouteContext<"/api/polls/[id]/response">,
) {
  const { id } = await ctx.params;
  const poll = await getPoll(id);

  if (!poll) {
    return Response.json({ error: "Poll not found." }, { status: 404 });
  }

  const cookieStore = await cookies();

  if (
    cookieStore.get(studentConsentCookieName(poll.sessionCode))?.value !==
    "accepted"
  ) {
    return Response.json(
      { error: "Please join the session before answering." },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    optionIds?: unknown[];
    participantId?: string;
  };

  try {
    const response = await savePollResponse(
      poll.id,
      String(body.participantId ?? ""),
      Array.isArray(body.optionIds) ? body.optionIds.map(String) : [],
    );

    if (!response) {
      return Response.json({ error: "Poll not found." }, { status: 404 });
    }

    return Response.json({ response });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save answer." },
      { status: 400 },
    );
  }
}
