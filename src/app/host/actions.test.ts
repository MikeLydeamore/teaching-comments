import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class EntitlementLimitError extends Error {}
  return {
    EntitlementLimitError,
    acceptInvitation: vi.fn(),
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
  declineSpaceInvitation: vi.fn(),
  getSpaceMemberRole: vi.fn(),
  getTeacherSpace: mocks.getTeacherSpace,
  leaveSpace: vi.fn(),
  normalizeSessionCode: (value: string) => value,
  normalizeSpaceCode: (value: string) => value,
}));

import { acceptSpaceInvitation } from "./actions";

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
