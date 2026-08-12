export interface TicketBase {
  v: 1;
  op: "upload" | "finalize" | "read";
  sessionHash: string;
  submissionId: string;
  contentType: ImageType;
  byteSize: number;
  exp: number;
}

export interface UploadTicket extends TicketBase {
  op: "upload" | "finalize";
  uploadId: string;
  clientId: string;
}

export interface ReadTicket extends TicketBase {
  op: "read";
  etag: string;
}

type Ticket = UploadTicket | ReadTicket;
type ImageType = "image/png" | "image/jpeg" | "image/webp";

const MAX_BYTES = 10 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_HASH = /^[A-Za-z0-9_-]{43}$/;
const TYPES: ReadonlySet<string> = new Set(["image/png", "image/jpeg", "image/webp"]);

function json(status: number, error: string, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ error }), { status, headers: responseHeaders });
}

function allowedOrigins(env: Env): string[] | null {
  if (typeof env.ALLOWED_ORIGINS !== "string" || !env.ALLOWED_ORIGINS.trim()) return null;
  const values = env.ALLOWED_ORIGINS.split(",").map((item) => item.trim());
  if (values.some((value) => !value)) return null;
  try {
    return values.every((value) => {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && url.origin === value && !url.username && !url.password && !url.pathname.replace("/", "") && !url.search && !url.hash;
    }) ? values : null;
  } catch {
    return null;
  }
}

function hasSecureConfiguration(env: Env): boolean {
  return typeof env.TICKET_SECRET === "string" && env.TICKET_SECRET.length >= 32 &&
    typeof env.SERVICE_TOKEN === "string" && env.SERVICE_TOKEN.length >= 32 &&
    allowedOrigins(env) !== null;
}

function extension(contentType: ImageType): "png" | "jpg" | "webp" {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg") return "jpg";
  return "webp";
}

function contentTypeFromCommittedKey(key: string): ImageType | null {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".jpg")) return "image/jpeg";
  if (key.endsWith(".webp")) return "image/webp";
  return null;
}

function pendingKey(ticket: UploadTicket): string {
  return `pending/${ticket.sessionHash}/${ticket.submissionId}/${ticket.uploadId}.${extension(ticket.contentType)}`;
}

function committedKey(ticket: Pick<TicketBase, "sessionHash" | "submissionId" | "contentType">): string {
  return `committed/${ticket.sessionHash}/${ticket.submissionId}.${extension(ticket.contentType)}`;
}

function base64UrlDecode(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
    const decoded = atob(base64);
    return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

function base64UrlEncode(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === [...expected].sort()[index]);
}

function isTicketBase(value: Record<string, unknown>): boolean {
  return value.v === 1 &&
    (value.op === "upload" || value.op === "finalize" || value.op === "read") &&
    typeof value.sessionHash === "string" && SESSION_HASH.test(value.sessionHash) &&
    typeof value.submissionId === "string" && UUID.test(value.submissionId) &&
    typeof value.contentType === "string" && TYPES.has(value.contentType) &&
    typeof value.byteSize === "number" && Number.isInteger(value.byteSize) && value.byteSize >= 1 && value.byteSize <= MAX_BYTES &&
    typeof value.exp === "number" && Number.isInteger(value.exp) && Number.isSafeInteger(value.exp);
}

async function validateTicket(encoded: string | null, env: Env, expectedOp: Ticket["op"], maxLifetimeSeconds: number): Promise<Ticket | null> {
  if (!encoded) return null;
  const parts = encoded.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const payloadBytes = base64UrlDecode(parts[0]);
  const signature = base64UrlDecode(parts[1]);
  if (!payloadBytes || !signature || signature.byteLength !== 32) return null;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(env.TICKET_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const verified = await crypto.subtle.verify("HMAC", key, signature.buffer as ArrayBuffer, new TextEncoder().encode(parts[0]));
  if (!verified) return null;

  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  const expected = expectedOp === "read"
    ? ["v", "op", "sessionHash", "submissionId", "contentType", "byteSize", "exp", "etag"]
    : ["v", "op", "sessionHash", "submissionId", "contentType", "byteSize", "exp", "uploadId", "clientId"];
  if (!exactKeys(candidate, expected) || !isTicketBase(candidate) || candidate.op !== expectedOp) return null;
  if (expectedOp === "read") {
    if (typeof candidate.etag !== "string" || !candidate.etag || candidate.etag.length > 256) return null;
  } else if (typeof candidate.uploadId !== "string" || !UUID.test(candidate.uploadId) || typeof candidate.clientId !== "string" || !UUID.test(candidate.clientId)) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  const expiration = candidate.exp as number;
  if (expiration <= now || expiration > now + maxLifetimeSeconds) return null;
  return candidate as unknown as Ticket;
}

function uploadCors(request: Request, env: Env): Headers | null {
  const origin = request.headers.get("Origin");
  const allowed = allowedOrigins(env);
  if (!origin || !allowed || !allowed.includes(origin)) return null;
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Expose-Headers": "ETag",
    "Vary": "Origin"
  });
}

function hasCorrectMagic(contentType: ImageType, bytes: Uint8Array): boolean {
  if (contentType === "image/png") return bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a;
  if (contentType === "image/jpeg") return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  return bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

function uploadMetadata(ticket: UploadTicket): Record<string, string> {
  return { uploadId: ticket.uploadId, clientId: ticket.clientId, sessionHash: ticket.sessionHash, submissionId: ticket.submissionId, contentType: ticket.contentType, byteSize: String(ticket.byteSize) };
}

function metadataMatches(object: R2Object, metadata: Record<string, string>): boolean {
  const custom = object.customMetadata ?? {};
  return object.httpMetadata?.contentType === metadata.contentType &&
    Object.keys(custom).length === Object.keys(metadata).length &&
    Object.entries(metadata).every(([key, value]) => custom[key] === value);
}

async function handleUpload(request: Request, env: Env, url: URL): Promise<Response> {
  const cors = uploadCors(request, env);
  if (!cors) return json(403, "origin_not_allowed");
  const ticket = await validateTicket(url.searchParams.get("ticket"), env, "upload", 120) as UploadTicket | null;
  if (!ticket) return json(401, "invalid_ticket", cors);
  const length = request.headers.get("Content-Length");
  if (!length || !/^[1-9][0-9]*$/.test(length) || Number(length) !== ticket.byteSize || Number(length) > MAX_BYTES || !Number.isSafeInteger(Number(length))) return json(400, "invalid_content_length", cors);
  if (request.headers.get("Content-Type") !== ticket.contentType) return json(415, "invalid_content_type", cors);
  const [client, session] = await Promise.all([
    env.CLIENT_RATE.limit({ key: `${ticket.clientId}:${ticket.sessionHash}` }),
    env.SESSION_RATE.limit({ key: ticket.sessionHash })
  ]);
  if (!client.success || !session.success) return json(429, "rate_limited", cors);

  const buffer = await request.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength !== ticket.byteSize || bytes.byteLength > MAX_BYTES) return json(400, "content_length_mismatch", cors);
  if (!hasCorrectMagic(ticket.contentType, bytes)) return json(415, "invalid_image_magic", cors);
  if (await env.IMAGES.head(committedKey(ticket))) return json(409, "upload_replayed", cors);
  const object = await env.IMAGES.put(pendingKey(ticket), buffer, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: ticket.contentType },
    customMetadata: uploadMetadata(ticket)
  });
  if (!object) return json(409, "upload_replayed", cors);
  cors.set("ETag", object.httpEtag);
  cors.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify({ etag: object.etag }), { status: 201, headers: cors });
}

function authorised(request: Request, env: Env): boolean {
  const value = request.headers.get("Authorization");
  return value === `Bearer ${env.SERVICE_TOKEN}`;
}

async function requestJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function isR2ObjectBody(value: R2ObjectBody | R2Object | null): value is R2ObjectBody {
  return value !== null && "body" in value && value.body !== undefined;
}

async function handleFinalize(request: Request, env: Env): Promise<Response> {
  if (!authorised(request, env)) return json(401, "unauthorized");
  const body = await requestJson(request);
  if (!body || !exactKeys(body, ["ticket", "uploadEtag"]) || typeof body.ticket !== "string" || typeof body.uploadEtag !== "string" || !body.uploadEtag || body.uploadEtag.length > 256) return json(400, "invalid_request");
  const ticket = await validateTicket(body.ticket, env, "finalize", 600) as UploadTicket | null;
  if (!ticket) return json(401, "invalid_ticket");
  const committedMetadata = { uploadId: ticket.uploadId, sessionHash: ticket.sessionHash, submissionId: ticket.submissionId, contentType: ticket.contentType, byteSize: String(ticket.byteSize), sourceEtag: body.uploadEtag };
  const key = committedKey(ticket);
  const finalResponse = (object: R2Object) => new Response(JSON.stringify({ objectKey: key, contentType: ticket.contentType, byteSize: ticket.byteSize, etag: object.etag }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
  const pending = await env.IMAGES.get(pendingKey(ticket), { onlyIf: { etagMatches: body.uploadEtag } });
  if (!isR2ObjectBody(pending) || pending.etag !== body.uploadEtag || !metadataMatches(pending, uploadMetadata(ticket))) {
    const existing = await env.IMAGES.head(key);
    return existing && metadataMatches(existing, committedMetadata) ? finalResponse(existing) : json(409, "pending_mismatch");
  }
  const committed = await env.IMAGES.put(key, pending.body, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: ticket.contentType },
    customMetadata: committedMetadata
  });
  let finalObject: R2Object;
  if (committed) {
    finalObject = committed;
  } else {
    const existing = await env.IMAGES.head(key);
    if (!existing || !metadataMatches(existing, committedMetadata)) return json(409, "committed_conflict");
    finalObject = existing;
  }
  // Keep the immutable pending object as a one-day replay tombstone. The pending/
  // lifecycle rule removes it asynchronously; deleting here would let the same
  // still-valid upload capability recreate its deterministic pending key.
  return finalResponse(finalObject);
}

async function handleRead(env: Env, url: URL): Promise<Response> {
  const ticket = await validateTicket(url.searchParams.get("ticket"), env, "read", 60) as ReadTicket | null;
  if (!ticket) return json(401, "invalid_ticket");
  const object = await env.IMAGES.get(committedKey(ticket), { onlyIf: { etagMatches: ticket.etag } });
  if (!isR2ObjectBody(object) || object.etag !== ticket.etag) return json(404, "not_found");
  return new Response(object.body, { headers: { "Content-Type": ticket.contentType, "Content-Disposition": "inline", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "ETag": object.httpEtag } });
}

async function handleList(request: Request, env: Env, url: URL): Promise<Response> {
  if (!authorised(request, env)) return json(401, "unauthorized");
  const limitRaw = url.searchParams.get("limit") ?? "100";
  if (!/^[1-9][0-9]*$/.test(limitRaw)) return json(400, "invalid_limit");
  const limit = Number(limitRaw);
  if (!Number.isSafeInteger(limit) || limit > 1000) return json(400, "invalid_limit");
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const page = await env.IMAGES.list({ prefix: "committed/", cursor, limit });
  return new Response(JSON.stringify({ objects: page.objects.map((object) => ({ key: object.key, etag: object.etag, size: object.size, uploaded: object.uploaded.toISOString(), contentType: object.httpMetadata?.contentType ?? object.customMetadata?.contentType ?? contentTypeFromCommittedKey(object.key) })), cursor: page.truncated ? page.cursor : null, truncated: page.truncated }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function validDeletePayload(body: Record<string, unknown>): body is { sessionHash: string; submissionId: string; contentType: ImageType; etag: string } {
  return exactKeys(body, ["sessionHash", "submissionId", "contentType", "etag"]) && typeof body.sessionHash === "string" && SESSION_HASH.test(body.sessionHash) && typeof body.submissionId === "string" && UUID.test(body.submissionId) && typeof body.contentType === "string" && TYPES.has(body.contentType) && typeof body.etag === "string" && body.etag.length > 0 && body.etag.length <= 256;
}

async function handleDelete(request: Request, env: Env): Promise<Response> {
  if (!authorised(request, env)) return json(401, "unauthorized");
  const body = await requestJson(request);
  if (!body || !validDeletePayload(body)) return json(400, "invalid_request");
  const key = committedKey(body);
  const object = await env.IMAGES.head(key);
  if (!object || object.etag !== body.etag) return json(409, "etag_mismatch");
  await env.IMAGES.delete(key);
  return new Response(JSON.stringify({ deleted: true }), { headers: { "Content-Type": "application/json; charset=utf-8" } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!hasSecureConfiguration(env)) return json(500, "service_misconfigured");
    const url = new URL(request.url);
    if (url.pathname === "/upload" && request.method === "OPTIONS") {
      const cors = uploadCors(request, env);
      return cors ? new Response(null, { status: 204, headers: cors }) : json(403, "origin_not_allowed");
    }
    if (url.pathname === "/upload" && request.method === "PUT") return handleUpload(request, env, url);
    if (url.pathname === "/internal/finalize" && request.method === "POST") return handleFinalize(request, env);
    if (url.pathname === "/image" && request.method === "GET") return handleRead(env, url);
    if (url.pathname === "/internal/images" && request.method === "GET") return handleList(request, env, url);
    if (url.pathname === "/internal/delete" && request.method === "POST") return handleDelete(request, env);
    return json(404, "not_found");
  }
} satisfies ExportedHandler<Env>;

export const ticketEncoding = { base64UrlEncode };
export const configuration = { allowedOrigins, hasSecureConfiguration };
