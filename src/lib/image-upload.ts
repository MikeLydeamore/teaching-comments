import { timingSafeEqual } from "node:crypto";

export const IMAGE_CONTENT_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type ImageContentType = (typeof IMAGE_CONTENT_TYPES)[number];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type TicketOperation = "upload" | "finalize" | "read";
export type ImageTicket = {
  v: 1;
  op: TicketOperation;
  sessionHash: string;
  submissionId: string;
  contentType: ImageContentType;
  byteSize: number;
  exp: number;
  uploadId?: string;
  clientId?: string;
  etag?: string;
};

const encoder = new TextEncoder();
const SESSION_HASH = /^[A-Za-z0-9_-]{43}$/;
const COMMON_KEYS = ["v", "op", "sessionHash", "submissionId", "contentType", "byteSize", "exp"];
const CLOCK_TOLERANCE_SECONDS = 5;
const FORBIDDEN_IMAGE_FIELDS = ["imageData", "image", "objectKey", "contentType", "byteSize", "etag", "submissionId", "uploadTicket"];

/** A signed-ticket rejection: callers should discard the browser upload receipt. */
export class ImageTicketVerificationError extends Error {
  constructor(message = "Invalid image ticket.") { super(message); this.name = "ImageTicketVerificationError"; }
}

function ticketFailure(message?: string): never { throw new ImageTicketVerificationError(message); }

export function hasForbiddenImageFields(body: Record<string, unknown>) {
  return FORBIDDEN_IMAGE_FIELDS.some((key) => key in body);
}

export function committedObjectKey(sessionHashValue: string, submissionId: string, contentType: ImageContentType) {
  const extension = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
  return `committed/${sessionHashValue}/${submissionId}.${extension}`;
}

export function postInsertRecovery(
  existing: { sessionCode: string; imageData: { objectKey: string; contentType: string; byteSize: number; etag: string } | null } | null,
  canonicalSessionId: string,
  imageData: { objectKey: string; contentType: string; byteSize: number; etag: string } | null,
  error: unknown,
) {
  const exact = Boolean(existing && existing.sessionCode === canonicalSessionId && existing.imageData?.objectKey === imageData?.objectKey && existing.imageData?.contentType === imageData?.contentType && existing.imageData?.byteSize === imageData?.byteSize && existing.imageData?.etag === imageData?.etag);
  if (exact) return "success" as const;
  const status = error && typeof error === "object" && "status" in error ? (error as { status?: unknown }).status : undefined;
  const message = error instanceof Error ? error.message : "";
  return status === 409 || /submission needs|session is closed|text.*(long|empty)|name.*long|identifier is already in use/i.test(message) ? "cleanup" as const : "preserve" as const;
}

function base64url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function decodeBase64url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("Malformed ticket.");
  return new Uint8Array(Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64"));
}

function ticketSecret() {
  const secret = process.env.IMAGE_TICKET_SECRET;
  if (!secret || secret.length < 32) throw new Error("Image uploads are not configured.");
  return secret;
}

async function hmac(value: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(ticketSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

export async function sessionHash(sessionId: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(sessionId))));
}

export async function signImageTicket(ticket: ImageTicket) {
  const part = base64url(encoder.encode(JSON.stringify(ticket)));
  return `${part}.${base64url(await hmac(part))}`;
}

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

export async function verifyImageTicket(value: unknown, expected?: Partial<ImageTicket>) {
  if (typeof value !== "string") ticketFailure();
  const [part, signature, ...extra] = value.split(".");
  if (!part || !signature || extra.length) ticketFailure();
  let given: Uint8Array;
  try { given = decodeBase64url(signature); } catch { ticketFailure(); }
  const expectedSignature = await hmac(part);
  if (given.byteLength !== expectedSignature.byteLength || !timingSafeEqual(Buffer.from(given), Buffer.from(expectedSignature))) ticketFailure();
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder().decode(decodeBase64url(part))); } catch { ticketFailure(); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) ticketFailure();
  const ticket = parsed as Partial<ImageTicket>;
  if (ticket.v !== 1 || !["upload", "finalize", "read"].includes(String(ticket.op))) ticketFailure();
  const keys = ticket.op === "read" ? [...COMMON_KEYS, "etag"] : [...COMMON_KEYS, "uploadId", "clientId"];
  if (!exactKeys(ticket as Record<string, unknown>, keys) || typeof ticket.sessionHash !== "string" || !SESSION_HASH.test(ticket.sessionHash) || !isUuid(ticket.submissionId) || !IMAGE_CONTENT_TYPES.includes(ticket.contentType as ImageContentType) || typeof ticket.byteSize !== "number" || !Number.isSafeInteger(ticket.byteSize) || ticket.byteSize < 1 || ticket.byteSize > MAX_IMAGE_BYTES || typeof ticket.exp !== "number" || !Number.isSafeInteger(ticket.exp)) ticketFailure();
  const maxLifetime = ticket.op === "upload" ? 120 : ticket.op === "finalize" ? 600 : 60;
  const now = Math.floor(Date.now() / 1000);
  if (ticket.exp < now - CLOCK_TOLERANCE_SECONDS || ticket.exp > now + maxLifetime + CLOCK_TOLERANCE_SECONDS) ticketFailure("Invalid or expired image ticket.");
  if ((ticket.op === "upload" || ticket.op === "finalize") && (!isUuid(ticket.uploadId) || !isUuid(ticket.clientId))) ticketFailure();
  if (ticket.op === "read" && (typeof ticket.etag !== "string" || !ticket.etag || ticket.etag.length > 256)) ticketFailure();
  for (const [key, expectedValue] of Object.entries(expected ?? {})) if (ticket[key as keyof ImageTicket] !== expectedValue) ticketFailure("Image ticket does not match this request.");
  return ticket as ImageTicket;
}

export function imageUploadsEnabled() {
  if (process.env.IMAGE_UPLOADS_ENABLED !== "true") return false;
  const secret = process.env.IMAGE_TICKET_SECRET;
  const token = process.env.IMAGE_WORKER_SERVICE_TOKEN;
  const workerUrl = process.env.IMAGE_WORKER_URL;
  if (!secret || secret.length < 32 || !token || token.length < 32 || token.length > 4096 || !workerUrl) return false;
  try { const url = new URL(workerUrl); return url.protocol === "https:" || url.protocol === "http:"; } catch { return false; }
}

export function uploadClientCookieName(sessionId: string) {
  return `qwt_image_upload_client_${sessionId}`;
}
