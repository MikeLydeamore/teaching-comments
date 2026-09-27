import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentTeacher: vi.fn(),
  getOrganizationMemberRole: vi.fn(),
  getPersonalOrganization: vi.fn(),
  removeOrganizationMember: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-server", () => ({ getCurrentTeacher: mocks.getCurrentTeacher }));
vi.mock("@/lib/teacher-session-auth", () => ({
  loginRedirectPath: (path: string) => `/auth/login?returnTo=${path}`,
}));
vi.mock("@/lib/edie-store", () => ({
  getOrganizationMemberRole: mocks.getOrganizationMemberRole,
  getPersonalOrganization: mocks.getPersonalOrganization,
  removeOrganizationMember: mocks.removeOrganizationMember,
}));

import { removeOrganizationSeat } from "./actions";

function removalForm(userId: string) {
  const formData = new FormData();
  formData.set("accountId", userId);
  return formData;
}

describe("removeOrganizationSeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue({ id: "owner-1" });
    mocks.getPersonalOrganization.mockResolvedValue({ id: "org-1" });
    mocks.getOrganizationMemberRole.mockResolvedValue("owner");
    mocks.removeOrganizationMember.mockResolvedValue(true);
  });

  it("removes a non-owner from the signed-in owner's organization", async () => {
    await expect(removeOrganizationSeat(removalForm("member-1"))).rejects.toThrow(
      "redirect:/host/organization?member=removed",
    );
    expect(mocks.removeOrganizationMember).toHaveBeenCalledWith("org-1", "member-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/host");
  });

  it("does not allow the owner to remove their own seat", async () => {
    await expect(removeOrganizationSeat(removalForm("owner-1"))).rejects.toThrow(
      "redirect:/host/organization?member=protected",
    );
    expect(mocks.removeOrganizationMember).not.toHaveBeenCalled();
  });

  it("requires organization ownership", async () => {
    mocks.getOrganizationMemberRole.mockResolvedValue("member");
    await expect(removeOrganizationSeat(removalForm("member-1"))).rejects.toThrow(
      "redirect:/host",
    );
    expect(mocks.removeOrganizationMember).not.toHaveBeenCalled();
  });
});
