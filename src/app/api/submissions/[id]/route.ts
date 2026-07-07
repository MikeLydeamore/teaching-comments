import { updateSubmission } from "@/lib/qwt-store";
import { isTeacherAuthenticated, teacherUnauthorizedResponse } from "@/lib/teacher-auth";

export async function PATCH(request: Request, ctx: RouteContext<"/api/submissions/[id]">) {
  if (!(await isTeacherAuthenticated())) {
    return teacherUnauthorizedResponse();
  }

  const { id } = await ctx.params;
  const patch = await request.json().catch(() => ({}));

  try {
    const submission = await updateSubmission(id, patch);

    if (!submission) {
      return Response.json({ error: "Submission not found." }, { status: 404 });
    }

    return Response.json({ submission });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not update submission." },
      { status: 400 },
    );
  }
}
