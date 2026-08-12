import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/qwt-store";
import { studentConsentCookieName } from "@/lib/student-consent-cookie";
import { IMAGE_CONTENT_TYPES, MAX_IMAGE_BYTES, imageUploadsEnabled, isUuid, sessionHash, signImageTicket, uploadClientCookieName, type ImageContentType } from "@/lib/image-upload";

export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[sessionCode]/image-upload">) {
  if (!imageUploadsEnabled()) return Response.json({ error: "Image uploads are unavailable." }, { status: 404 });
  const { sessionCode } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { contentType?: unknown; byteSize?: unknown };
  if (!IMAGE_CONTENT_TYPES.includes(body.contentType as ImageContentType) || !Number.isSafeInteger(body.byteSize) || (body.byteSize as number) < 1 || (body.byteSize as number) > MAX_IMAGE_BYTES) return Response.json({ error: "Choose a PNG, JPEG, or WebP image up to 10 MiB." }, { status: 400 });
  const session = await getSession(sessionCode);
  if (!session || !session.isOpen) return Response.json({ error: "This Ed.ie session is closed or unavailable." }, { status: 400 });
  if (!session.imageInputEnabled) return Response.json({ error: "Image responses are disabled for this session." }, { status: 400 });
  const cookieStore = await cookies();
  if (cookieStore.get(studentConsentCookieName(session.id))?.value !== "accepted") return Response.json({ error: "Please join the session and acknowledge the privacy notice first." }, { status: 403 });
  let clientId = cookieStore.get(uploadClientCookieName(session.id))?.value;
  const response = NextResponse.json(await (async () => {
    if (!isUuid(clientId)) clientId = randomUUID();
    const submissionId = randomUUID();
    const uploadId = randomUUID();
    const common = { v: 1 as const, sessionHash: await sessionHash(session.id), submissionId, contentType: body.contentType as ImageContentType, byteSize: body.byteSize as number };
    const uploadTicket = await signImageTicket({ ...common, op: "upload", uploadId, clientId, exp: Math.floor(Date.now() / 1000) + 120 });
    const finalizeTicket = await signImageTicket({ ...common, op: "finalize", uploadId, clientId, exp: Math.floor(Date.now() / 1000) + 600 });
    return { submissionId, uploadUrl: `${process.env.IMAGE_WORKER_URL!.replace(/\/$/, "")}/upload?ticket=${encodeURIComponent(uploadTicket)}`, uploadTicket, finalizeTicket };
  })());
  response.cookies.set(uploadClientCookieName(session.id), clientId!, { httpOnly: true, maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  return response;
}
