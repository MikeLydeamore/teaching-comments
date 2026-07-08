import { unvoteGroupQuestion, upvoteGroupQuestion } from "@/lib/qwt-store";

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/group-questions/[id]/vote">,
) {
  const { id } = await ctx.params;
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
