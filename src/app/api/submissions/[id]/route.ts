import { getSubmission, toSubmissionDto, updateSubmission } from "@/lib/edie-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";
import { publishSubmissionViewInvalidation } from "@/lib/submission-view-realtime";

export async function PATCH(request: Request, ctx: RouteContext<"/api/submissions/[id]">) {
  const { id } = await ctx.params;
  const currentSubmission = await getSubmission(id);

  if (!currentSubmission) {
    return Response.json({ error: "Submission not found." }, { status: 404 });
  }

  const authorization = await getAuthorizedTeacherSession(
    currentSubmission.sessionCode,
  );

  if (authorization.response) {
    return authorization.response;
  }

  const patch = await request.json().catch(() => ({}));

  try {
    const submission = await updateSubmission(
      currentSubmission.sessionCode,
      id,
      patch,
    );

    if (!submission) {
      return Response.json({ error: "Submission not found." }, { status: 404 });
    }

    await publishSubmissionViewInvalidation(submission.sessionCode);
    return Response.json({ submission: toSubmissionDto(submission) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update submission." },
      { status: 400 },
    );
  }
}
