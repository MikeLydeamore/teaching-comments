import { getGroupQuestion, getSession, unvoteGroupQuestion, upvoteGroupQuestion } from "@/lib/edie-store";

async function questionIsAvailable(id: string) {
  const question = await getGroupQuestion(id);
  return Boolean(question && await getSession(question.sessionCode));
}

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]/vote">,
) {
  const { id } = await ctx.params;
  if (!(await questionIsAvailable(id))) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { voterId?: string };

  try {
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
  if (!(await questionIsAvailable(id))) {
    return Response.json({ error: "Question not found." }, { status: 404 });
  }
  const body = (await request.json().catch(() => ({}))) as { voterId?: string };

  try {
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
