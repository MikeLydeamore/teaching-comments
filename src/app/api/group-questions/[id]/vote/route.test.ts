import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getAuthorizedTeacherSession,
  getGroupQuestion,
  getSession,
  requireParticipantAdmission,
  upvoteGroupQuestion,
} = vi.hoisted(() => ({
  getAuthorizedTeacherSession: vi.fn(),
  getGroupQuestion: vi.fn(),
  getSession: vi.fn(),
  requireParticipantAdmission: vi.fn(),
  upvoteGroupQuestion: vi.fn(),
}));

vi.mock("@/lib/edie-store", () => ({
  getGroupQuestion,
  getSession,
  unvoteGroupQuestion: vi.fn(),
  upvoteGroupQuestion,
}));
vi.mock("@/lib/teacher-session-auth", () => ({ getAuthorizedTeacherSession }));
vi.mock("@/lib/participant-admission", () => ({ requireParticipantAdmission }));

import { POST } from "./route";

const context = { params: Promise.resolve({ id: "question-1" }) } as never;

beforeEach(() => {
  getAuthorizedTeacherSession.mockReset();
  getGroupQuestion.mockReset();
  getSession.mockReset();
  requireParticipantAdmission.mockReset();
  upvoteGroupQuestion.mockReset();
  getGroupQuestion.mockResolvedValue({ id: "question-1", sessionCode: "session-1" });
  getSession.mockResolvedValue({ id: "session-1" });
});

describe("group-question vote capacity", () => {
  it("enforces capacity for an anonymous participant", async () => {
    getAuthorizedTeacherSession.mockResolvedValue({ response: new Response(null, { status: 401 }) });
    requireParticipantAdmission.mockResolvedValue(new Response(null, { status: 429 }));

    const response = await POST(new Request("https://example.test/api/group-questions/question-1/vote", {
      method: "POST",
      body: JSON.stringify({ participantId: "participant_123", voterId: "voter_123" }),
    }), context);

    expect(response.status).toBe(429);
    expect(upvoteGroupQuestion).not.toHaveBeenCalled();
  });

  it("does not consume a participant place for an authorized teacher", async () => {
    getAuthorizedTeacherSession.mockResolvedValue({ session: { id: "session-1" } });
    upvoteGroupQuestion.mockResolvedValue({ id: "question-1" });

    const response = await POST(new Request("https://example.test/api/group-questions/question-1/vote", {
      method: "POST",
      body: JSON.stringify({ voterId: "teacher_voter" }),
    }), context);

    expect(response.status).toBe(200);
    expect(requireParticipantAdmission).not.toHaveBeenCalled();
  });
});
