import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivePollMock,
  getPollResponseMock,
  getSessionMock,
  admitParticipantMock,
} = vi.hoisted(() => ({
  getActivePollMock: vi.fn(),
  getPollResponseMock: vi.fn(),
  getSessionMock: vi.fn(),
  admitParticipantMock: vi.fn(),
}));

vi.mock("@/lib/edie-store", () => ({
  getActivePoll: getActivePollMock,
  getPollResponse: getPollResponseMock,
  getSession: getSessionMock,
}));
vi.mock("@/lib/participant-admission", () => ({
  admitParticipant: admitParticipantMock,
}));

import { GET } from "./route";

const session = {
  code: "room-1",
  drawingInputEnabled: true,
  gifInputEnabled: true,
  id: "internal-session-1",
  imageEmbedsEnabled: true,
  imageInputEnabled: true,
  isOpen: true,
  prompt: "Prompt",
  textInputEnabled: true,
  timerDurationSeconds: 30,
  timerEndsAt: null,
};
const context = { params: Promise.resolve({ sessionCode: "room-1" }) };

beforeEach(() => {
  getActivePollMock.mockReset();
  getPollResponseMock.mockReset();
  getSessionMock.mockReset();
  admitParticipantMock.mockReset();
  getSessionMock.mockResolvedValue(session);
  getActivePollMock.mockResolvedValue(null);
  admitParticipantMock.mockResolvedValue({
    status: "admitted",
    connectedParticipants: 1,
    limit: 30,
  });
});

describe("student session route", () => {
  it("records an explicitly requested presence heartbeat", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/sessions/room-1/student?participantId=participant_123&presence=1",
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(admitParticipantMock).toHaveBeenCalledWith(
      session,
      "participant_123",
    );
    await expect(response.json()).resolves.toMatchObject({
      activePoll: null,
      admission: { status: "admitted", connectedParticipants: 1, limit: 30 },
      session: { code: session.code, isOpen: true, prompt: "Prompt" },
    });
  });

  it("does not record presence without the heartbeat flag", async () => {
    const response = await GET(
      new Request(
        "https://example.test/api/sessions/room-1/student?participantId=participant_123",
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(admitParticipantMock).not.toHaveBeenCalled();
  });

  it("keeps the student response available when Redis presence fails", async () => {
    admitParticipantMock.mockResolvedValue({
      status: "admitted",
      connectedParticipants: null,
      limit: 30,
    });

    const response = await GET(
      new Request(
        "https://example.test/api/sessions/room-1/student?participantId=participant_123&presence=1",
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      session: { code: session.code },
    });
  });

  it("withholds session activity data while the participant waits for capacity", async () => {
    admitParticipantMock.mockResolvedValue({
      status: "full",
      connectedParticipants: 30,
      limit: 30,
    });

    const response = await GET(
      new Request(
        "https://example.test/api/sessions/room-1/student?participantId=participant_123&presence=1",
      ),
      context as never,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      admission: { status: "full", connectedParticipants: 30, limit: 30 },
      session: { isOpen: true },
    });
    expect(getActivePollMock).not.toHaveBeenCalled();
  });
});
