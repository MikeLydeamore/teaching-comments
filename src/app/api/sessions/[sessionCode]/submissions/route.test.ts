import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  addSubmissionMock,
  getSessionMock,
  hasForbiddenImageFieldsMock,
  publishInvalidationMock,
} = vi.hoisted(() => ({
  addSubmissionMock: vi.fn(),
  getSessionMock: vi.fn(),
  hasForbiddenImageFieldsMock: vi.fn(),
  publishInvalidationMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "accepted" }) })),
}));
vi.mock("@/lib/edie-store", () => ({
  addSubmission: addSubmissionMock,
  getSession: getSessionMock,
  getSubmission: vi.fn(),
  listSubmissions: vi.fn(),
  toSubmissionDto: (submission: unknown) => submission,
}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: vi.fn(),
}));
vi.mock("@/lib/student-consent-cookie", () => ({
  studentConsentCookieName: () => "consent",
}));
vi.mock("@/lib/image-upload", () => ({
  ImageTicketVerificationError: class ImageTicketVerificationError extends Error {},
  committedObjectKey: vi.fn(),
  hasForbiddenImageFields: hasForbiddenImageFieldsMock,
  imageUploadsEnabled: () => false,
  postInsertRecovery: vi.fn(),
  sessionHash: vi.fn(),
  uploadClientCookieName: vi.fn(),
  verifyImageTicket: vi.fn(),
}));
vi.mock("@/lib/edie-store-model", () => ({
  assertSubmissionUsesEnabledInputs: vi.fn(),
  normalizeStudentName: (name: string) => name,
  validateSubmissionContent: (text: string) => ({
    drawingData: null,
    gifData: null,
    text,
  }),
}));
vi.mock("@/lib/submission-time-range", () => ({
  parseSubmissionMinutes: vi.fn(),
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  publishSubmissionViewInvalidation: publishInvalidationMock,
}));

import { POST } from "./route";

const context = { params: Promise.resolve({ sessionCode: "session-1" }) };
const session = {
  id: "internal-session-1",
  imageInputEnabled: true,
  isOpen: true,
};

beforeEach(() => {
  addSubmissionMock.mockReset();
  getSessionMock.mockReset();
  hasForbiddenImageFieldsMock.mockReset();
  publishInvalidationMock.mockReset();
  getSessionMock.mockResolvedValue(session);
  hasForbiddenImageFieldsMock.mockReturnValue(false);
  addSubmissionMock.mockResolvedValue({
    id: "submission-1",
    imageData: null,
    sessionCode: session.id,
    text: "Hello",
  });
  publishInvalidationMock.mockResolvedValue(true);
});

describe("submission creation route", () => {
  it("publishes after a student response is committed", async () => {
    const response = await POST(
      new Request("https://example.test/api/sessions/session-1/submissions", {
        method: "POST",
        body: JSON.stringify({ text: "Hello" }),
      }),
      context as never,
    );

    expect(response.status).toBe(201);
    expect(publishInvalidationMock).toHaveBeenCalledWith(session.id);
  });

  it("does not publish rejected requests", async () => {
    hasForbiddenImageFieldsMock.mockReturnValue(true);

    const response = await POST(
      new Request("https://example.test/api/sessions/session-1/submissions", {
        method: "POST",
        body: JSON.stringify({ imageData: { objectKey: "forbidden" } }),
      }),
      context as never,
    );

    expect(response.status).toBe(400);
    expect(publishInvalidationMock).not.toHaveBeenCalled();
  });
});
