import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker, { configuration } from "../src/index";

const SECRET = "test-ticket-secret-that-is-safely-longer-than-32";
const ORIGIN = "https://app.example.test";
const SESSION = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const SUBMISSION = "11111111-1111-4111-8111-111111111111";
const CLIENT = "22222222-2222-4222-8222-222222222222";

type Ticket = Record<string, unknown>;

function b64(value: Uint8Array): string {
  let text = "";
  for (const part of value) text += String.fromCharCode(part);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sign(payload: Ticket): Promise<string> {
  const first = b64(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return `${first}.${b64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(first))))}`;
}

async function ticket(overrides: Partial<Ticket> = {}, op: "upload" | "finalize" | "read" = "upload"): Promise<string> {
  const common = { v: 1, op, sessionHash: SESSION, submissionId: SUBMISSION, contentType: "image/png", byteSize: 8, exp: Math.floor(Date.now() / 1000) + 50 };
  const operation = op === "read" ? { etag: "unused" } : { uploadId: "33333333-3333-4333-8333-333333333333", clientId: CLIENT };
  return sign({ ...common, ...operation, ...overrides });
}

function png(): Uint8Array {
  return new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
}

function jpeg(): Uint8Array {
  return new Uint8Array([0xff, 0xd8, 0xff]);
}

function webp(): Uint8Array {
  return new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
}

async function upload(uploadTicket: string, content: Uint8Array = png(), length = content.byteLength, contentType = "image/png"): Promise<Response> {
  return SELF.fetch(`https://worker.example/upload?ticket=${encodeURIComponent(uploadTicket)}`, {
    method: "PUT",
    headers: { Origin: ORIGIN, "Content-Type": contentType, "Content-Length": String(length) },
    body: content
  });
}

async function finalize(finalizeTicket: string, uploadEtag: string): Promise<Response> {
  return SELF.fetch("https://worker.example/internal/finalize", { method: "POST", headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32", "Content-Type": "application/json" }, body: JSON.stringify({ ticket: finalizeTicket, uploadEtag }) });
}

describe("private image gateway", () => {
  it("fails closed for weak secrets and malformed origin configuration", () => {
    const base = { IMAGES: {} as R2Bucket, CLIENT_RATE: {} as RateLimit, SESSION_RATE: {} as RateLimit, TICKET_SECRET: SECRET, SERVICE_TOKEN: "test-service-token-that-is-safely-longer-than-32", ALLOWED_ORIGINS: ORIGIN };
    expect(configuration.hasSecureConfiguration({ ...base, TICKET_SECRET: "too-short" })).toBe(false);
    expect(configuration.hasSecureConfiguration({ ...base, SERVICE_TOKEN: "" })).toBe(false);
    expect(configuration.hasSecureConfiguration({ ...base, ALLOWED_ORIGINS: "https://app.example.test/path" })).toBe(false);
    expect(configuration.hasSecureConfiguration({ ...base, ALLOWED_ORIGINS: "https://app.example.test," })).toBe(false);
  });

  it("does not serve requests when its security configuration is invalid", async () => {
    const response = await worker.fetch(new Request("https://worker.example/image"), {
      IMAGES: {} as R2Bucket,
      CLIENT_RATE: {} as RateLimit,
      SESSION_RATE: {} as RateLimit,
      TICKET_SECRET: "too-short",
      SERVICE_TOKEN: "also-too-short",
      ALLOWED_ORIGINS: ORIGIN
    }, {} as ExecutionContext);
    expect(response.status).toBe(500);
  });

  it("rejects invalid origins, signatures, expiry, and malformed ticket keys", async () => {
    const valid = await ticket();
    expect((await SELF.fetch(`https://worker.example/upload?ticket=${valid}`, { method: "OPTIONS", headers: { Origin: "https://evil.example" } })).status).toBe(403);
    expect((await upload(`${valid}x`)).status).toBe(401);
    expect((await upload(await ticket({ exp: Math.floor(Date.now() / 1000) - 1 }))).status).toBe(401);
    expect((await upload(await sign({ v: 1, op: "upload", sessionHash: SESSION, submissionId: SUBMISSION, contentType: "image/png", byteSize: 8, exp: Math.floor(Date.now() / 1000) + 50, uploadId: "33333333-3333-4333-8333-333333333333", clientId: CLIENT, extra: true }))).status).toBe(401);
  });

  it("requires a signed exact length and validates actual bytes and image magic", async () => {
    const valid = await ticket({ uploadId: "33333333-3333-4333-8333-333333333334" });
    expect((await SELF.fetch(`https://worker.example/upload?ticket=${valid}`, { method: "PUT", headers: { Origin: ORIGIN, "Content-Type": "image/png" } })).status).toBe(400);
    expect((await SELF.fetch(`https://worker.example/upload?ticket=${valid}`, { method: "PUT", headers: { Origin: ORIGIN, "Content-Type": "image/png", "Content-Length": "false" }, body: png() })).status).toBe(400);
    expect((await upload(valid, png(), 7)).status).toBe(400);
    expect((await upload(valid, png().slice(0, 7), 8)).status).toBe(400);
    expect((await upload(valid, new Uint8Array(8))).status).toBe(415);
    expect((await upload(valid, new Uint8Array(8), 10 * 1024 * 1024 + 1)).status).toBe(400);
    const maxTicket = await ticket({ uploadId: "33333333-3333-4333-8333-333333333338", byteSize: 10 * 1024 * 1024 });
    const oversized = new Uint8Array(10 * 1024 * 1024 + 1);
    oversized.set(png());
    expect((await upload(maxTicket, oversized, 10 * 1024 * 1024)).status).toBe(400);
  });

  it("requires the exact MIME header and recognizes each allowed image signature", async () => {
    const jpegTicket = await ticket({ uploadId: "33333333-3333-4333-8333-333333333339", contentType: "image/jpeg", byteSize: jpeg().byteLength });
    expect((await upload(jpegTicket, jpeg(), jpeg().byteLength, "image/png")).status).toBe(415);
    expect((await upload(jpegTicket, jpeg(), jpeg().byteLength, "image/jpeg")).status).toBe(201);
    const webpTicket = await ticket({ uploadId: "33333333-3333-4333-8333-333333333340", contentType: "image/webp", byteSize: webp().byteLength });
    expect((await upload(webpTicket, webp(), webp().byteLength, "image/webp")).status).toBe(201);
  });

  it("stores once and returns an ETag", async () => {
    const first = await ticket({ uploadId: "33333333-3333-4333-8333-333333333335" });
    const stored = await upload(first);
    expect(stored.status).toBe(201);
    const payload = await stored.json<{ etag: string }>();
    expect(payload.etag).toMatch(/.+/);
    expect(stored.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(stored.headers.get("ETag")).toMatch(/^".+"$/);
    expect((await upload(first)).status).toBe(409);

  });

  it("requires internal finalize authorization, checks pending ETags, and retries idempotently", async () => {
    const uploadId = "33333333-3333-4333-8333-333333333336";
    const uploadTicket = await ticket({ uploadId });
    const uploaded = await upload(uploadTicket);
    const { etag: pendingEtag } = await uploaded.json<{ etag: string }>();
    const finalizeTicket = await ticket({ op: "finalize", uploadId }, "finalize");
    expect((await SELF.fetch("https://worker.example/internal/finalize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticket: finalizeTicket, uploadEtag: pendingEtag }) })).status).toBe(401);
    expect((await finalize(await ticket({ op: "finalize", uploadId, exp: Math.floor(Date.now() / 1000) - 1 }, "finalize"), pendingEtag)).status).toBe(401);
    expect((await finalize(finalizeTicket, "wrong")).status).toBe(409);
    const result = await finalize(finalizeTicket, pendingEtag);
    expect(result.status).toBe(200);
    const committed = await result.json<{ etag: string; objectKey: string }>();
    expect(committed.objectKey).toBe(`committed/${SESSION}/${SUBMISSION}.png`);
    const retry = await finalize(finalizeTicket, pendingEtag);
    expect(retry.status).toBe(200);
    expect((await retry.json<{ etag: string }>()).etag).toBe(committed.etag);
    expect((await upload(uploadTicket)).status).toBe(409);

    const readTicket = await ticket({ op: "read", etag: committed.etag }, "read");
    const image = await SELF.fetch(`https://worker.example/image?ticket=${encodeURIComponent(readTicket)}`);
    expect(image.status).toBe(200);
    expect(image.headers.get("Cache-Control")).toBe("private, no-store");
    expect(image.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(image.headers.get("ETag")).toMatch(/^".+"$/);
    expect(image.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(image.headers.get("Content-Disposition")).toBe("inline");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(png());
    expect((await SELF.fetch(`https://worker.example/image?ticket=${encodeURIComponent(await ticket({ op: "read", etag: "wrong" }, "read"))}`)).status).toBe(404);
  });

  it("fails closed when a different immutable upload targets a committed key", async () => {
    const submissionId = "77777777-7777-4777-8777-777777777777";
    const firstId = "33333333-3333-4333-8333-333333333341";
    const secondId = "33333333-3333-4333-8333-333333333342";
    const clientId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const firstUpload = await upload(await ticket({ submissionId, uploadId: firstId, clientId }));
    const { etag: firstPendingEtag } = await firstUpload.json<{ etag: string }>();
    const secondUpload = await upload(await ticket({ submissionId, uploadId: secondId, clientId }));
    expect(secondUpload.status).toBe(201);
    const { etag: secondPendingEtag } = await secondUpload.json<{ etag: string }>();
    const firstFinal = await finalize(await ticket({ op: "finalize", submissionId, uploadId: firstId, clientId }, "finalize"), firstPendingEtag);
    const { etag: committedEtag } = await firstFinal.json<{ etag: string }>();
    const conflict = await finalize(await ticket({ op: "finalize", submissionId, uploadId: secondId, clientId }, "finalize"), secondPendingEtag);
    expect(conflict.status).toBe(409);
    expect((await upload(await ticket({ submissionId, uploadId: "33333333-3333-4333-8333-333333333344", clientId }))).status).toBe(409);
    const readTicket = await ticket({ op: "read", submissionId, etag: committedEtag }, "read");
    expect((await SELF.fetch(`https://worker.example/image?ticket=${encodeURIComponent(readTicket)}`)).status).toBe(200);
  });

  it("lists only committed objects with reconciliation fields, paginates, and deletes only exact structured targets", async () => {
    expect((await SELF.fetch("https://worker.example/internal/images")).status).toBe(401);
    const uploadId = "33333333-3333-4333-8333-333333333337";
    const submissionId = "55555555-5555-4555-8555-555555555555";
    const uploaded = await upload(await ticket({ uploadId, submissionId, clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }));
    const { etag: pendingEtag } = await uploaded.json<{ etag: string }>();
    expect(uploaded.status).toBe(201);
    const finalized = await finalize(await ticket({ op: "finalize", uploadId, submissionId, clientId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, "finalize"), pendingEtag);
    expect(finalized.status).toBe(200);
    const committed = await finalized.json<{ etag: string }>();
    const pendingOnlyTicket = await ticket({ uploadId: "33333333-3333-4333-8333-333333333343", clientId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", submissionId: "88888888-8888-4888-8888-888888888888" });
    expect((await upload(pendingOnlyTicket)).status).toBe(201);
    const listed = await SELF.fetch("https://worker.example/internal/images?limit=1", { headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32" } });
    expect(listed.status).toBe(200);
    const page = await listed.json<{ objects: Array<{ key: string; etag: string; size: number; uploaded: string; contentType: string }>; cursor: string | null; truncated: boolean }>();
    expect(page.objects.length).toBe(1);
    expect(page.objects[0]).toMatchObject({ key: expect.stringMatching(/^committed\//), etag: expect.any(String), size: expect.any(Number), uploaded: expect.any(String), contentType: expect.stringMatching(/^image\//) });
    expect(page.truncated).toBe(true);
    expect(page.cursor).toEqual(expect.any(String));
    const next = await SELF.fetch(`https://worker.example/internal/images?limit=1&cursor=${encodeURIComponent(page.cursor!)}`, { headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32" } });
    const nextPage = await next.json<{ objects: Array<{ key: string }>; truncated: boolean }>();
    expect(next.status).toBe(200);
    expect(nextPage.objects).toHaveLength(1);
    expect(nextPage.objects[0].key).not.toBe(page.objects[0].key);
    const deleteBody = { sessionHash: SESSION, submissionId, contentType: "image/png", etag: "wrong" };
    expect((await SELF.fetch("https://worker.example/internal/delete", { method: "POST", headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32", "Content-Type": "application/json" }, body: JSON.stringify({ sessionHash: SESSION, submissionId, contentType: "image/png", etag: committed.etag, unexpected: true }) })).status).toBe(400);
    expect((await SELF.fetch("https://worker.example/internal/delete", { method: "POST", headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32", "Content-Type": "application/json" }, body: JSON.stringify(deleteBody) })).status).toBe(409);
    expect((await SELF.fetch("https://worker.example/internal/delete", { method: "POST", headers: { Authorization: "Bearer test-service-token-that-is-safely-longer-than-32", "Content-Type": "application/json" }, body: JSON.stringify({ ...deleteBody, etag: committed.etag }) })).status).toBe(200);
  });

  it("applies the client rate limit", async () => {
    let limited: Response | undefined;
    for (let index = 0; index < 11; index += 1) {
      const id = `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`;
      limited = await upload(await ticket({ uploadId: id }));
    }
    expect(limited?.status).toBe(429);
  });

  it("applies the session rate limit across distinct clients", async () => {
    const sessionHash = "BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";
    let limited: Response | undefined;
    for (let index = 0; index < 301; index += 1) {
      const suffix = String(index).padStart(12, "0");
      limited = await upload(await ticket({
        sessionHash,
        uploadId: `99999999-9999-4999-8999-${suffix}`,
        clientId: `aaaaaaaa-aaaa-4aaa-8aaa-${suffix}`
      }));
    }
    expect(limited?.status).toBe(429);
  });
});
