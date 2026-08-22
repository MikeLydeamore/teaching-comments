import { cookies } from "next/headers";
import { addSubmission, getSession, getSubmission, listSubmissions, toSubmissionDto } from "@/lib/qwt-store";
import { parseSubmissionMinutes } from "@/lib/submission-time-range";
import { studentConsentCookieName } from "@/lib/student-consent-cookie";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";
import { committedObjectKey, hasForbiddenImageFields, ImageTicketVerificationError, imageUploadsEnabled, postInsertRecovery, sessionHash, uploadClientCookieName, verifyImageTicket, type ImageContentType } from "@/lib/image-upload";
import type { SubmissionImageData } from "@/lib/qwt-store";
import { assertSubmissionUsesEnabledInputs, validateSubmissionContent, normalizeStudentName } from "@/lib/qwt-store-model";

class ImageReceiptError extends Error {
  constructor(message: string, readonly invalidReceipt: boolean) { super(message); }
}

function invalidatesReceiptAfterCleanup(error: unknown) {
  const status = error && typeof error === "object" && "status" in error ? (error as { status?: unknown }).status : undefined;
  return status === 409 || /identifier is already in use/i.test(error instanceof Error ? error.message : "");
}

async function deleteFinalizedImage(sessionHashValue: string, submissionId: string, imageData: SubmissionImageData | null) {
  if (!imageData || !process.env.IMAGE_WORKER_URL || !process.env.IMAGE_WORKER_SERVICE_TOKEN) return;
  const response = await fetch(`${process.env.IMAGE_WORKER_URL.replace(/\/$/, "")}/internal/delete`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.IMAGE_WORKER_SERVICE_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sessionHash: sessionHashValue, submissionId, contentType: imageData.contentType, etag: imageData.etag }),
    cache: "no-store",
  }).catch(() => null);
  return response?.ok ?? false;
}

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
  const minutes = minutesParam ? parseSubmissionMinutes(minutesParam) : undefined;
  const includeHidden = url.searchParams.get("includeHidden") === "true";
  const promptHistoryId = url.searchParams.get("promptHistoryId") || undefined;
  const submissions = await listSubmissions(sessionCode, {
    minutes,
    includeHidden,
    promptHistoryId,
  });

  return Response.json({ submissions: submissions.map(toSubmissionDto) });
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
    finalizeTicket?: unknown;
    uploadEtag?: unknown;
  };

  try {
    if (hasForbiddenImageFields(body)) {
      return Response.json({ error: "Image metadata must not be supplied by the browser." }, { status: 400 });
    }
    if (body.website) {
      return Response.json({ error: "Could not save submission." }, { status: 400 });
    }

    const cookieStore = await cookies();

    const canonicalSession = await getSession(sessionCode);
    if (!canonicalSession) {
      return Response.json({ error: "This Ed.ie session does not exist." }, { status: 400 });
    }

    if (!canonicalSession.isOpen) {
      return Response.json({ error: "This Ed.ie session is closed." }, { status: 400 });
    }

    if (cookieStore.get(studentConsentCookieName(canonicalSession.id))?.value !== "accepted") {
      return Response.json(
        { error: "Please join the session and acknowledge the privacy notice first." },
        { status: 403 },
      );
    }

    const hasFinalize = typeof body.finalizeTicket === "string";
    const hasEtag = typeof body.uploadEtag === "string";
    if (hasFinalize !== hasEtag) return Response.json({ error: "The image upload is incomplete." }, { status: 400 });
    let imageData: SubmissionImageData | null = null;
    let suppliedId: string | undefined;
    if (hasFinalize) {
      if (!imageUploadsEnabled()) return Response.json({ error: "Image uploads are unavailable." }, { status: 400 });
      if (!canonicalSession.imageInputEnabled) return Response.json({ error: "Image responses are disabled for this session." }, { status: 400 });
      const clientId = cookieStore.get(uploadClientCookieName(canonicalSession.id))?.value;
      const ticket = await verifyImageTicket(body.finalizeTicket, { op: "finalize", sessionHash: await sessionHash(canonicalSession.id), clientId });
      suppliedId = ticket.submissionId;
      // Validate all deterministic form inputs before committing an uploaded object.
      const submissionContent = validateSubmissionContent(body.text ?? "", body.drawingData, body.gifData, {
        version: 1,
        objectKey: committedObjectKey(ticket.sessionHash, ticket.submissionId, ticket.contentType),
        contentType: ticket.contentType,
        byteSize: ticket.byteSize,
        etag: "preflight",
      });
      assertSubmissionUsesEnabledInputs(canonicalSession, submissionContent.text, submissionContent.drawingData, submissionContent.gifData, {
        version: 1,
        objectKey: committedObjectKey(ticket.sessionHash, ticket.submissionId, ticket.contentType),
        contentType: ticket.contentType,
        byteSize: ticket.byteSize,
        etag: "preflight",
      });
      normalizeStudentName(body.studentName ?? "");
      const finalized = await fetch(`${process.env.IMAGE_WORKER_URL!.replace(/\/$/, "")}/internal/finalize`, { method: "POST", headers: { "Authorization": `Bearer ${process.env.IMAGE_WORKER_SERVICE_TOKEN!}`, "Content-Type": "application/json" }, body: JSON.stringify({ ticket: body.finalizeTicket, uploadEtag: body.uploadEtag }), cache: "no-store" });
      if (!finalized.ok) throw new ImageReceiptError("The image could not be finalized. Please try submitting again.", [400, 401, 409].includes(finalized.status));
      const data = await finalized.json() as { objectKey?: unknown; contentType?: unknown; byteSize?: unknown; etag?: unknown };
      if (typeof data.objectKey !== "string" || data.objectKey !== committedObjectKey(ticket.sessionHash, ticket.submissionId, ticket.contentType) || data.contentType !== ticket.contentType || !Number.isSafeInteger(data.byteSize) || data.byteSize !== ticket.byteSize || data.byteSize < 1 || data.byteSize > 10 * 1024 * 1024 || typeof data.etag !== "string" || !data.etag || data.etag.length > 256) throw new Error("The image service returned invalid metadata.");
      imageData = { version: 1 as const, objectKey: data.objectKey, contentType: data.contentType as ImageContentType, byteSize: data.byteSize, etag: data.etag };
    }
    if (!hasFinalize) {
      const submissionContent = validateSubmissionContent(body.text ?? "", body.drawingData, body.gifData);
      assertSubmissionUsesEnabledInputs(canonicalSession, submissionContent.text, submissionContent.drawingData, submissionContent.gifData);
    }
    try {
      const submission = await addSubmission(canonicalSession.id, { id: suppliedId, text: body.text ?? "", drawingData: body.drawingData, gifData: body.gifData, imageData, studentName: body.studentName });
      return Response.json({ submission: toSubmissionDto(submission) }, { status: 201 });
    } catch (storeError) {
      if (suppliedId) {
        const existing = await getSubmission(suppliedId).catch(() => null);
        const recovery = postInsertRecovery(existing, canonicalSession.id, imageData, storeError);
        if (recovery === "success" && existing) return Response.json({ submission: toSubmissionDto(existing) }, { status: 201 });
        if (recovery === "cleanup") {
          const deleted = await deleteFinalizedImage(await sessionHash(canonicalSession.id), suppliedId, imageData);
          if (deleted && invalidatesReceiptAfterCleanup(storeError)) throw new ImageReceiptError("The image receipt could not be used. Please submit again to create a new receipt.", true);
        }
      }
      throw storeError;
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not save submission.", imageReceiptInvalid: (error instanceof ImageReceiptError && error.invalidReceipt) || error instanceof ImageTicketVerificationError },
      { status: 400 },
    );
  }
}
