import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActivePollMock,
  getPollResponseMock,
  getSessionMock,
  recordSessionPresenceMock,
} = vi.hoisted(() => ({
  getActivePollMock: vi.fn(),
  getPollResponseMock: vi.fn(),
  getSessionMock: vi.fn(),
  recordSessionPresenceMock: vi.fn(),
}));

vi.mock("@/lib/edie-store", () => ({
  getActivePoll: getActivePollMock,
  getPollResponse: getPollResponseMock,
  getSession: getSessionMock,
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  recordSessionPresence: recordSessionPresenceMock,
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
  recordSessionPresenceMock.mockReset();
  getSessionMock.mockResolvedValue(session);
  getActivePollMock.mockResolvedValue(null);
  recordSessionPresenceMock.mockResolvedValue(true);
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
    expect(recordSessionPresenceMock).toHaveBeenCalledWith(
      session.id,
      "participant_123",
    );
    await expect(response.json()).resolves.toMatchObject({
      activePoll: null,
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
    expect(recordSessionPresenceMock).not.toHaveBeenCalled();
  });

  it("keeps the student response available when Redis presence fails", async () => {
    recordSessionPresenceMock.mockResolvedValue(false);

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
});
