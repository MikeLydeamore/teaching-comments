import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class EntitlementLimitError extends Error {}
  return {
    EntitlementLimitError,
    acceptInvitation: vi.fn(),
    createTeacherSpaceForOwner: vi.fn(),
    ensurePersonalOrganization: vi.fn(),
    entitlementsForOrganization: vi.fn(),
    getCurrentTeacher: vi.fn(),
    getTeacherSpace: vi.fn(),
    redirect: vi.fn((path: string) => {
      throw new Error(`redirect:${path}`);
    }),
    revalidatePath: vi.fn(),
  };
});

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth", () => ({ getAuth: vi.fn() }));
vi.mock("@/lib/auth-server", () => ({ getCurrentTeacher: mocks.getCurrentTeacher }));
vi.mock("@/lib/teacher-session-auth", () => ({
  loginRedirectPath: (path: string) => `/auth/login?returnTo=${path}`,
}));
vi.mock("@/lib/entitlements", () => ({
  EntitlementLimitError: mocks.EntitlementLimitError,
  entitlementsForOrganization: mocks.entitlementsForOrganization,
}));
vi.mock("@/lib/edie-store", () => ({
  acceptSpaceInvitation: mocks.acceptInvitation,
  createTeacherSpaceForOwner: mocks.createTeacherSpaceForOwner,
  declineSpaceInvitation: vi.fn(),
  ensurePersonalOrganization: mocks.ensurePersonalOrganization,
  getSpaceMemberRole: vi.fn(),
  getTeacherSpace: mocks.getTeacherSpace,
  leaveSpace: vi.fn(),
  normalizeSessionCode: (value: string) => value,
  normalizeSpaceCode: (value: string) => value,
}));

import { acceptSpaceInvitation, createHostedSpace } from "./actions";

describe("acceptSpaceInvitation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue({
      id: "user-2",
      email: "teacher@example.com",
      emailVerified: true,
      username: "teacher",
    });
    mocks.getTeacherSpace.mockResolvedValue({
      code: "stats-101",
      organizationId: "org-1",
    });
    mocks.entitlementsForOrganization.mockResolvedValue({
      limits: { teacherSeats: 5 },
    });
    mocks.acceptInvitation.mockResolvedValue(true);
    mocks.ensurePersonalOrganization.mockResolvedValue({ id: "org-1" });
    mocks.createTeacherSpaceForOwner.mockResolvedValue({ code: "stats-101" });
  });

  it("passes the organisation seat limit to the atomic acceptance", async () => {
    const formData = new FormData();
    formData.set("spaceCode", "stats-101");
    await expect(acceptSpaceInvitation(formData)).rejects.toThrow(
      "redirect:/host/invitations?invitation=accepted",
    );
    expect(mocks.acceptInvitation).toHaveBeenCalledWith(
      "stats-101",
      "user-2",
      "teacher@example.com",
      5,
    );
  });

  it("shows a seat-limit result without consuming the invitation", async () => {
    mocks.acceptInvitation.mockRejectedValue(new mocks.EntitlementLimitError());
    const formData = new FormData();
    formData.set("spaceCode", "stats-101");
    await expect(acceptSpaceInvitation(formData)).rejects.toThrow(
      "redirect:/host/invitations?invitation=seat-limit",
    );
  });
});

describe("createHostedSpace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue({
      id: "user-1",
      email: "teacher@example.com",
      username: "teacher",
      name: "Teacher",
    });
    mocks.ensurePersonalOrganization.mockResolvedValue({ id: "org-1" });
    mocks.entitlementsForOrganization.mockResolvedValue({
      limits: { ownedSpaces: 3 },
    });
    mocks.createTeacherSpaceForOwner.mockResolvedValue({ code: "stats-101" });
  });

  it("passes the organisation space limit to the atomic creation", async () => {
    const formData = new FormData();
    formData.set("spaceCode", "stats-101");
    formData.set("spaceName", "Statistics");

    await expect(createHostedSpace(formData)).rejects.toThrow(
      "redirect:/host/stats-101",
    );
    expect(mocks.createTeacherSpaceForOwner).toHaveBeenCalledWith(
      "stats-101",
      "Statistics",
      { userId: "user-1", name: "Teacher" },
      3,
    );
  });

  it("reports the hosted-space limit", async () => {
    mocks.createTeacherSpaceForOwner.mockRejectedValue(
      new mocks.EntitlementLimitError(),
    );
    const formData = new FormData();
    formData.set("spaceCode", "stats-101");
    formData.set("spaceName", "Statistics");

    await expect(createHostedSpace(formData)).rejects.toThrow(
      "redirect:/host?spaceCreate=space-limit",
    );
  });
});
