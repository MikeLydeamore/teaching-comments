import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPoll, getSession, requireParticipantAdmission, savePollResponse } = vi.hoisted(() => ({
  getPoll: vi.fn(),
  getSession: vi.fn(),
  requireParticipantAdmission: vi.fn(),
  savePollResponse: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => ({ value: "accepted" }) })),
}));
vi.mock("@/lib/edie-store", () => ({ getPoll, getSession, savePollResponse }));
vi.mock("@/lib/student-consent-cookie", () => ({ studentConsentCookieName: () => "consent" }));
vi.mock("@/lib/participant-admission", () => ({ requireParticipantAdmission }));

import { PUT } from "./route";

beforeEach(() => {
  getPoll.mockReset();
  getSession.mockReset();
  requireParticipantAdmission.mockReset();
  savePollResponse.mockReset();
  getPoll.mockResolvedValue({ id: "poll-1", sessionCode: "session-1" });
  getSession.mockResolvedValue({ id: "session-1" });
});

describe("poll participant capacity", () => {
  it("does not save a poll response when the session is full", async () => {
    requireParticipantAdmission.mockResolvedValue(Response.json(
      { code: "SESSION_CAPACITY_REACHED" },
      { status: 429 },
    ));

    const response = await PUT(new Request("https://example.test/api/polls/poll-1/response", {
      method: "PUT",
      body: JSON.stringify({ participantId: "participant_123", optionIds: ["option-1"] }),
    }), { params: Promise.resolve({ id: "poll-1" }) } as never);

    expect(response.status).toBe(429);
    expect(savePollResponse).not.toHaveBeenCalled();
  });
});
