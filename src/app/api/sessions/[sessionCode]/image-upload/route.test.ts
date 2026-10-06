import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, requireParticipantAdmission } = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireParticipantAdmission: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "accepted" }) })),
}));
vi.mock("@/lib/edie-store", () => ({ getSession }));
vi.mock("@/lib/student-consent-cookie", () => ({ studentConsentCookieName: () => "consent" }));
vi.mock("@/lib/participant-admission", () => ({ requireParticipantAdmission }));
vi.mock("@/lib/image-upload", () => ({
  IMAGE_CONTENT_TYPES: ["image/png"],
  MAX_IMAGE_BYTES: 10 * 1024 * 1024,
  imageUploadsEnabled: () => true,
  isUuid: vi.fn(),
  sessionHash: vi.fn(),
  signImageTicket: vi.fn(),
  uploadClientCookieName: () => "upload-client",
}));

import { POST } from "./route";

beforeEach(() => {
  getSession.mockReset();
  requireParticipantAdmission.mockReset();
  getSession.mockResolvedValue({ id: "session-1", imageInputEnabled: true, isOpen: true });
});

describe("image upload participant capacity", () => {
  it("does not allocate an upload when the session is full", async () => {
    requireParticipantAdmission.mockResolvedValue(Response.json(
      { code: "SESSION_CAPACITY_REACHED" },
      { status: 429 },
    ));

    const response = await POST(new Request("https://example.test/api/sessions/session-1/image-upload", {
      method: "POST",
      body: JSON.stringify({
        byteSize: 1024,
        contentType: "image/png",
        participantId: "participant_123",
      }),
    }), { params: Promise.resolve({ sessionCode: "session-1" }) } as never);

    expect(response.status).toBe(429);
  });
});
