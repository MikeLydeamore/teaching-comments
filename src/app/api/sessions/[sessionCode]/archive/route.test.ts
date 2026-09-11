import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  archiveMock,
  authorizationMock,
  getStatsMock,
  publishInvalidationMock,
  unarchiveMock,
  updateSettingsMock,
} = vi.hoisted(() => ({
  archiveMock: vi.fn(),
  authorizationMock: vi.fn(),
  getStatsMock: vi.fn(),
  publishInvalidationMock: vi.fn(),
  unarchiveMock: vi.fn(),
  updateSettingsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/edie-store", () => ({
  archiveSessionActivity: archiveMock,
  getSessionStats: getStatsMock,
  unarchiveSessionActivity: unarchiveMock,
  updateSubmissionViewSettings: updateSettingsMock,
}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: authorizationMock,
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  publishSubmissionViewInvalidation: publishInvalidationMock,
}));

import { DELETE, POST } from "./route";

const context = { params: Promise.resolve({ sessionCode: "session-1" }) };

beforeEach(() => {
  archiveMock.mockReset();
  authorizationMock.mockReset();
  getStatsMock.mockReset();
  publishInvalidationMock.mockReset();
  unarchiveMock.mockReset();
  updateSettingsMock.mockReset();
  authorizationMock.mockResolvedValue({
    session: { id: "internal-session-1" },
  });
  archiveMock.mockResolvedValue({ archivedAt: "2026-09-11T10:00:00.000Z" });
  unarchiveMock.mockResolvedValue({ archivedAt: "2026-09-11T10:00:00.000Z" });
  getStatsMock.mockResolvedValue({ total: 0 });
  updateSettingsMock.mockResolvedValue({ revision: 2 });
  publishInvalidationMock.mockResolvedValue(true);
});

describe("session archive route", () => {
  it("publishes after archiving and resetting the expanded card", async () => {
    const response = await POST(
      new Request("https://example.test/api/sessions/session-1/archive", {
        method: "POST",
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(updateSettingsMock).toHaveBeenCalledWith("session-1", {
      expandedSubmissionId: null,
    });
    expect(publishInvalidationMock).toHaveBeenCalledWith("internal-session-1");
  });

  it("publishes after restoring an archive", async () => {
    const response = await DELETE(
      new Request("https://example.test/api/sessions/session-1/archive", {
        method: "DELETE",
        body: JSON.stringify({ archivedAt: "2026-09-11T10:00:00.000Z" }),
      }),
      context as never,
    );

    expect(response.status).toBe(200);
    expect(publishInvalidationMock).toHaveBeenCalledWith("internal-session-1");
  });
});

