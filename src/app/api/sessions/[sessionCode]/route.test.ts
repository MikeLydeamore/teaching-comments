import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authorizationMock,
  getSessionStatsMock,
  listPromptHistoryMock,
  publishInvalidationMock,
  updateSessionMock,
} = vi.hoisted(() => ({
  authorizationMock: vi.fn(),
  getSessionStatsMock: vi.fn(),
  listPromptHistoryMock: vi.fn(),
  publishInvalidationMock: vi.fn(),
  updateSessionMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/edie-store", () => ({
  getSessionStats: getSessionStatsMock,
  listPromptHistory: listPromptHistoryMock,
  updateSession: updateSessionMock,
}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: authorizationMock,
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  publishSubmissionViewInvalidation: publishInvalidationMock,
}));

import { PATCH } from "./route";

const session = { id: "internal-session-1", prompt: "Prompt" };
const context = { params: Promise.resolve({ sessionCode: "session-1" }) };

beforeEach(() => {
  authorizationMock.mockReset();
  getSessionStatsMock.mockReset();
  listPromptHistoryMock.mockReset();
  publishInvalidationMock.mockReset();
  updateSessionMock.mockReset();
  authorizationMock.mockResolvedValue({ session });
  getSessionStatsMock.mockResolvedValue({ total: 0 });
  listPromptHistoryMock.mockResolvedValue([]);
  publishInvalidationMock.mockResolvedValue(true);
  updateSessionMock.mockResolvedValue(session);
});

describe("session mutation route", () => {
  it("invalidates the submission view after prompt changes", async () => {
    const response = await PATCH(
      new Request("https://example.test/api/sessions/session-1", {
        method: "PATCH",
        body: JSON.stringify({ prompt: "Next prompt" }),
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(publishInvalidationMock).toHaveBeenCalledWith(session.id);
  });

  it("does not invalidate the submission view for unrelated timer changes", async () => {
    const response = await PATCH(
      new Request("https://example.test/api/sessions/session-1", {
        method: "PATCH",
        body: JSON.stringify({ timerDurationSeconds: 30 }),
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(publishInvalidationMock).not.toHaveBeenCalled();
  });
});

