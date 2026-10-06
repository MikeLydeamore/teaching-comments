import { beforeEach, describe, expect, it, vi } from "vitest";

const { addGroupQuestion, getSession, requireParticipantAdmission } = vi.hoisted(() => ({
  addGroupQuestion: vi.fn(),
  getSession: vi.fn(),
  requireParticipantAdmission: vi.fn(),
}));

vi.mock("@/lib/edie-store", () => ({
  addGroupQuestion,
  getSession,
  listGroupQuestions: vi.fn(),
}));
vi.mock("@/lib/teacher-session-auth", () => ({ getAuthorizedTeacherSession: vi.fn() }));
vi.mock("@/lib/participant-admission", () => ({ requireParticipantAdmission }));

import { POST } from "./route";

beforeEach(() => {
  addGroupQuestion.mockReset();
  getSession.mockReset();
  requireParticipantAdmission.mockReset();
  getSession.mockResolvedValue({ id: "session-1" });
});

describe("group-question participant capacity", () => {
  it("does not add a question when the session is full", async () => {
    requireParticipantAdmission.mockResolvedValue(Response.json(
      { code: "SESSION_CAPACITY_REACHED" },
      { status: 429 },
    ));

    const response = await POST(new Request("https://example.test/api/sessions/session-1/group-questions", {
      method: "POST",
      body: JSON.stringify({ participantId: "participant_123", text: "A valid question?" }),
    }), { params: Promise.resolve({ sessionCode: "session-1" }) } as never);

    expect(response.status).toBe(429);
    expect(addGroupQuestion).not.toHaveBeenCalled();
  });
});
