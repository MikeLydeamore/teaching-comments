import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizationMock,
  getSubmissionMock,
  publishInvalidationMock,
  updateSubmissionMock,
} = vi.hoisted(() => ({
  authorizationMock: vi.fn(),
  getSubmissionMock: vi.fn(),
  publishInvalidationMock: vi.fn(),
  updateSubmissionMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/edie-store", () => ({
  getSubmission: getSubmissionMock,
  toSubmissionDto: (submission: unknown) => submission,
  updateSubmission: updateSubmissionMock,
}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: authorizationMock,
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  publishSubmissionViewInvalidation: publishInvalidationMock,
}));

import { PATCH } from "./route";

const context = { params: Promise.resolve({ id: "submission-1" }) };
const submission = {
  id: "submission-1",
  imageData: null,
  sessionCode: "internal-session-1",
  status: "hidden",
  text: "Response",
};

beforeEach(() => {
  authorizationMock.mockReset();
  getSubmissionMock.mockReset();
  publishInvalidationMock.mockReset();
  updateSubmissionMock.mockReset();
  getSubmissionMock.mockResolvedValue({ sessionCode: submission.sessionCode });
  authorizationMock.mockResolvedValue({ session: { id: submission.sessionCode } });
  updateSubmissionMock.mockResolvedValue(submission);
  publishInvalidationMock.mockResolvedValue(true);
});

describe("submission mutation route", () => {
  it("publishes an invalidation after a successful update", async () => {
    const response = await PATCH(
      new Request("https://example.test/api/submissions/submission-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "hidden" }),
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(publishInvalidationMock).toHaveBeenCalledWith(
      submission.sessionCode,
    );
  });

  it("does not publish when the storage update fails", async () => {
    updateSubmissionMock.mockRejectedValue(new Error("Invalid update."));

    const response = await PATCH(
      new Request("https://example.test/api/submissions/submission-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "invalid" }),
      }),
      context as never,
    );

    expect(response.status).toBe(400);
    expect(publishInvalidationMock).not.toHaveBeenCalled();
  });

  it("keeps a committed update successful if publication is unavailable", async () => {
    publishInvalidationMock.mockResolvedValue(false);

    const response = await PATCH(
      new Request("https://example.test/api/submissions/submission-1", {
        method: "PATCH",
        body: JSON.stringify({ status: "hidden" }),
      }),
      context as never,
    );

    expect(response.status).toBe(200);
  });
});
