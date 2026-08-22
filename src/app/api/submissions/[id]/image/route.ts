import { getSubmission } from "@/lib/edie-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";
import { imageUploadsEnabled, sessionHash, signImageTicket } from "@/lib/image-upload";

export async function GET(request: Request, ctx: RouteContext<"/api/submissions/[id]/image">) {
  if (!imageUploadsEnabled()) return new Response(null, { status: 404 });
  const { id } = await ctx.params;
  const submission = await getSubmission(id);
  if (!submission?.imageData) return new Response(null, { status: 404 });
  const authorization = await getAuthorizedTeacherSession(submission.sessionCode);
  if (authorization.response) return authorization.response;
  const ticket = await signImageTicket({ v: 1, op: "read", sessionHash: await sessionHash(submission.sessionCode), submissionId: submission.id, contentType: submission.imageData.contentType, byteSize: submission.imageData.byteSize, etag: submission.imageData.etag, exp: Math.floor(Date.now() / 1000) + 60 });
  return new Response(null, { status: 307, headers: { Location: `${process.env.IMAGE_WORKER_URL!.replace(/\/$/, "")}/image?ticket=${encodeURIComponent(ticket)}`, "Cache-Control": "private, no-store" } });
}
