import { beforeEach, describe, expect, it } from "vitest";
import { assertSubmissionHasContent, normalizeSubmissionImageData } from "./qwt-store-model";
import { committedObjectKey, hasForbiddenImageFields, ImageTicketVerificationError, imageUploadsEnabled, isUuid, postInsertRecovery, sessionHash, signImageTicket, verifyImageTicket } from "./image-upload";
import { toSubmissionDto } from "./qwt-store";
import { collectSupabaseReferences, collectWorkerObjects, parseContentRange, planReconciliation, selectedBackend, validateReference } from "../../tools/reconcile-images.mjs";
import { outputImageContentType } from "../components/ImageUploadPanel";
import { submissionImageRetryUrl } from "../components/SubmissionImagePreview";

const sessionId = "demo-lecture";
const submissionId = "123e4567-e89b-42d3-a456-426614174000";
const uploadId = "123e4567-e89b-42d3-a456-426614174001";
const clientId = "123e4567-e89b-42d3-a456-426614174002";

beforeEach(() => {
  process.env.IMAGE_TICKET_SECRET = "a-test-secret-that-is-safely-longer-than-32";
});

it("fails closed when feature configuration is incomplete", () => {
  process.env.IMAGE_UPLOADS_ENABLED = "true";
  process.env.IMAGE_WORKER_URL = "not-a-url";
  process.env.IMAGE_WORKER_SERVICE_TOKEN = "token";
  expect(imageUploadsEnabled()).toBe(false);
  process.env.IMAGE_WORKER_URL = "https://worker.example";
  process.env.IMAGE_TICKET_SECRET = "short";
  expect(imageUploadsEnabled()).toBe(false);
  process.env.IMAGE_TICKET_SECRET = "a-test-secret-that-is-safely-longer-than-32";
  process.env.IMAGE_WORKER_SERVICE_TOKEN = "a-test-service-token-that-is-safely-longer-than-32";
  expect(imageUploadsEnabled()).toBe(true);
});

describe("reconciliation fail-closed pagination", () => {
  it("collects every Worker page and rejects a looping cursor", async () => {
    const pages = [
      { objects: [{ key: `committed/${"A".repeat(43)}/${submissionId}.png`, etag: "a", size: 4, uploaded: "2020-01-01T00:00:00.000Z", contentType: "image/png" }], cursor: "next", truncated: true },
      { objects: [], cursor: null, truncated: false },
    ];
    let index = 0;
    const result = await collectWorkerObjects(async () => new Response(JSON.stringify(pages[index++])), "https://worker.test", "token");
    expect(result).toHaveLength(1);
    await expect(collectWorkerObjects(async () => new Response(JSON.stringify({ objects: [], cursor: "same", truncated: true })), "https://worker.test", "token")).rejects.toThrow("pagination");
    expect(() => validateReference({ version: 1, objectKey: `committed/${"A".repeat(43)}/${submissionId}.png`, contentType: "image/png", byteSize: 1, etag: "e" })).not.toThrow();
  });
});

it("matches app backend selection and exact Supabase page counts", async () => {
  expect(selectedBackend({ QWT_STORAGE_BACKEND: "supabase" })).toBe("supabase");
  expect(selectedBackend({ QWT_STORAGE_BACKEND: "local", SUPABASE_URL: "x" })).toBe("local");
  expect(selectedBackend({ SUPABASE_URL: "x" })).toBe("supabase");
  expect(selectedBackend({})).toBe("local");
  expect(parseContentRange("0-999/1001", 0, 1000)).toBe(1001);
  expect(() => parseContentRange("0-999/1000", 1000, 1)).toThrow("mismatch");
  let call = 0;
  const row = { image_data: { version: 1, objectKey: `committed/${"A".repeat(43)}/${submissionId}.png`, contentType: "image/png", byteSize: 1, etag: "e" } };
  const refs = await collectSupabaseReferences(async () => new Response(JSON.stringify(call++ ? [row] : Array.from({ length: 1000 }, () => row)), { headers: { "content-range": call === 1 ? "0-999/1001" : "1000-1000/1001" } }), "https://db.test", "token");
  expect(refs).toHaveLength(1001);
  expect(() => planReconciliation([refs[0]], [{ key: refs[0].objectKey, etag: "wrong", size: 1, contentType: "image/png", uploaded: "2020-01-01T00:00:00.000Z" }])).toThrow("mismatch");
});

it("uses the actual canvas output MIME type", () => {
  expect(outputImageContentType("image/png")).toBe("image/png");
  expect(() => outputImageContentType("image/gif")).toThrow("unsupported");
});

it("uses a fresh image URL for automatic preview retries", () => {
  expect(submissionImageRetryUrl("/api/submissions/id/image", 0)).toBe(
    "/api/submissions/id/image",
  );
  expect(submissionImageRetryUrl("/api/submissions/id/image", 2)).toBe(
    "/api/submissions/id/image?imageRetry=2",
  );
  expect(submissionImageRetryUrl("/api/submissions/id/image?size=large", 3)).toBe(
    "/api/submissions/id/image?size=large&imageRetry=3",
  );
});

it("derives deterministic committed object keys", () => {
  expect(committedObjectKey("A".repeat(43), submissionId, "image/jpeg")).toBe(`committed/${"A".repeat(43)}/${submissionId}.jpg`);
});

it("fails closed for malformed persisted image metadata", () => {
  const valid = { version: 1, objectKey: `committed/${"A".repeat(43)}/${submissionId}.png`, contentType: "image/png", byteSize: 1, etag: "e" };
  expect(normalizeSubmissionImageData(valid)).toEqual(valid);
  expect(() => normalizeSubmissionImageData({ ...valid, extra: true })).toThrow("Invalid");
  expect(() => normalizeSubmissionImageData({ ...valid, byteSize: 10485761 })).toThrow("Invalid");
});

it("rejects browser-supplied internal image metadata", () => {
  expect(hasForbiddenImageFields({ imageData: {} })).toBe(true);
  expect(hasForbiddenImageFields({ finalizeTicket: "signed", uploadEtag: "raw" })).toBe(false);
});

it("keeps ambiguous post-insert outcomes and only cleans deterministic mismatches", () => {
  const imageData = { objectKey: "committed/x", contentType: "image/png", byteSize: 1, etag: "e" };
  expect(postInsertRecovery({ sessionCode: "session", imageData }, "session", imageData, new Error("timeout"))).toBe("success");
  expect(postInsertRecovery(null, "session", imageData, Object.assign(new Error("conflict"), { status: 409 }))).toBe("cleanup");
  expect(postInsertRecovery(null, "session", imageData, Object.assign(new Error("server"), { status: 500 }))).toBe("preserve");
  expect(postInsertRecovery({ sessionCode: "other", imageData }, "session", imageData, new Error("network"))).toBe("preserve");
  expect(postInsertRecovery(null, "session", imageData, new Error("This Ed.ie session is closed."))).toBe("cleanup");
});

describe("image tickets", () => {
  it("signs and verifies the compact web-crypto ticket", async () => {
    const ticket = await signImageTicket({ v: 1, op: "finalize", sessionHash: await sessionHash(sessionId), submissionId, uploadId, clientId, contentType: "image/png", byteSize: 12, exp: Math.floor(Date.now() / 1000) + 60 });
    expect(ticket).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    await expect(verifyImageTicket(ticket, { op: "finalize", submissionId })).resolves.toMatchObject({ clientId, uploadId });
    await expect(verifyImageTicket(ticket, { sessionHash: await sessionHash("other-session") })).rejects.toThrow("does not match");
    await expect(verifyImageTicket(ticket, { sessionHash: await sessionHash("other-session") })).rejects.toBeInstanceOf(ImageTicketVerificationError);
    await expect(verifyImageTicket(`${ticket}x`)).rejects.toThrow("Invalid");
    expect(isUuid("------------------------------------")).toBe(false);
    const extra = await signImageTicket({ v: 1, op: "finalize", sessionHash: await sessionHash(sessionId), submissionId, uploadId, clientId, contentType: "image/png", byteSize: 12, exp: Math.floor(Date.now() / 1000) + 60, extra: true } as never);
    await expect(verifyImageTicket(extra)).rejects.toThrow("Invalid");
    const expired = await signImageTicket({ v: 1, op: "read", sessionHash: await sessionHash(sessionId), submissionId, contentType: "image/png", byteSize: 12, etag: "etag", exp: Math.floor(Date.now() / 1000) - 10 });
    await expect(verifyImageTicket(expired)).rejects.toThrow("expired");
    await expect(verifyImageTicket(expired)).rejects.toBeInstanceOf(ImageTicketVerificationError);
    await expect(verifyImageTicket(ticket, { clientId: undefined })).rejects.toBeInstanceOf(ImageTicketVerificationError);
  });
});

describe("submission image invariants", () => {
  it("allows image-only responses and removes internal storage data from DTOs", () => {
    const imageData = { version: 1 as const, objectKey: "final/a", contentType: "image/webp" as const, byteSize: 42, etag: "quoted-etag" };
    expect(() => assertSubmissionHasContent("", null, null, imageData)).not.toThrow();
    const dto = toSubmissionDto({ id: submissionId, sessionCode: sessionId, studentName: "Anonymous", text: "", drawingData: null, gifData: null, imageData, status: "visible", starred: false, flagged: false, version: 1, archivedAt: null, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    expect(dto.image).toEqual({ contentType: "image/webp", byteSize: 42, url: `/api/submissions/${submissionId}/image` });
    expect(JSON.stringify(dto)).not.toContain("objectKey");
    expect(JSON.stringify(dto)).not.toContain("quoted-etag");
  });
});
