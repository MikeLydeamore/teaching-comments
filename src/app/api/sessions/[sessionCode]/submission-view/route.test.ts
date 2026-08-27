import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizationMock, payloadMock, updateSettingsMock } = vi.hoisted(() => ({
  authorizationMock: vi.fn(),
  payloadMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: authorizationMock,
}));
vi.mock("@/lib/submission-view", () => ({
  getSubmissionViewPayload: payloadMock,
}));
vi.mock("@/lib/edie-store", () => ({
  updateSubmissionViewSettings: updateSettingsMock,
}));

import { GET, PATCH } from "./route";

const session = { id: "session-1" };
const context = {
  params: Promise.resolve({ sessionCode: session.id }),
};

beforeEach(() => {
  authorizationMock.mockReset();
  payloadMock.mockReset();
  updateSettingsMock.mockReset();
  authorizationMock.mockResolvedValue({ session });
});

describe("submission view route", () => {
  it("requires teacher authorization", async () => {
    authorizationMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request(`https://example.test/api/sessions/${session.id}/submission-view`),
      context as never,
    );

    expect(response.status).toBe(401);
    expect(payloadMock).not.toHaveBeenCalled();
  });

  it("returns the canonical view with the requested hidden policy", async () => {
    payloadMock.mockResolvedValue({ submissions: [], viewSettings: {} });

    const response = await GET(
      new Request(
        `https://example.test/api/sessions/${session.id}/submission-view?includeHidden=true`,
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(payloadMock).toHaveBeenCalledWith(session, true);
  });

  it("updates a validated partial setting", async () => {
    updateSettingsMock.mockResolvedValue({ revision: 1, minutes: 10 });

    const response = await PATCH(
      new Request(
        `https://example.test/api/sessions/${session.id}/submission-view`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ minutes: 10 }),
        },
      ),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(updateSettingsMock).toHaveBeenCalledWith(session.id, { minutes: 10 });
  });

  it("returns validation failures as bad requests", async () => {
    updateSettingsMock.mockRejectedValue(new Error("Time range is invalid."));

    const response = await PATCH(
      new Request(
        `https://example.test/api/sessions/${session.id}/submission-view`,
        { method: "PATCH", body: JSON.stringify({ minutes: 2 }) },
      ),
      context as never,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Time range is invalid.",
    });
  });
});
