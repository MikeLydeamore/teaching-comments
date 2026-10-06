import { beforeEach, describe, expect, it, vi } from "vitest";

const { admitSessionParticipant, entitlementsForOrganization, getTeacherSpace } = vi.hoisted(() => ({
  admitSessionParticipant: vi.fn(),
  entitlementsForOrganization: vi.fn(),
  getTeacherSpace: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("./edie-store", () => ({ getTeacherSpace }));
vi.mock("./entitlements", () => ({ entitlementsForOrganization }));
vi.mock("./submission-view-realtime", () => ({ admitSessionParticipant }));

import {
  admitParticipant,
  capacityReachedResponse,
} from "./participant-admission";

const session = {
  id: "session-internal-1",
  spaceCode: "space-1",
} as never;

beforeEach(() => {
  admitSessionParticipant.mockReset();
  entitlementsForOrganization.mockReset();
  getTeacherSpace.mockReset();
  getTeacherSpace.mockResolvedValue({ organizationId: "org-1" });
  entitlementsForOrganization.mockResolvedValue({
    limits: { concurrentParticipants: 30 },
  });
  admitSessionParticipant.mockResolvedValue({
    status: "admitted",
    connectedParticipants: 12,
  });
});

describe("participant admission", () => {
  it("uses the owning organisation's per-session entitlement", async () => {
    await expect(admitParticipant(session, "participant_123")).resolves.toEqual({
      status: "admitted",
      connectedParticipants: 12,
      limit: 30,
    });
    expect(admitSessionParticipant).toHaveBeenCalledWith(
      "session-internal-1",
      "participant_123",
      30,
    );
  });

  it("fails open if a legacy session has no resolvable space", async () => {
    getTeacherSpace.mockResolvedValue(null);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(admitParticipant(session, "participant_123")).resolves.toEqual({
      status: "admitted",
      connectedParticipants: null,
      limit: null,
    });
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("returns a stable retryable capacity response", async () => {
    const response = capacityReachedResponse();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("3");
    await expect(response.json()).resolves.toMatchObject({
      code: "SESSION_CAPACITY_REACHED",
    });
  });
});
