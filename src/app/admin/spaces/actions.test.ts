import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acceptSpaceInvitation: vi.fn(),
  addSpaceMember: vi.fn(),
  findUserProfileByUsername: vi.fn(),
  getCurrentTeacher: vi.fn(),
  getTeacherSpace: vi.fn(),
  isAdminAuthenticated: vi.fn(),
  isAdminTeacher: vi.fn(),
  listSpaceMembers: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  revalidatePath: vi.fn(),
  updateSpaceMemberRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-server", () => ({
  getCurrentTeacher: mocks.getCurrentTeacher,
  isAdminAuthenticated: mocks.isAdminAuthenticated,
  isAdminTeacher: mocks.isAdminTeacher,
}));
vi.mock("@/lib/auth-users", () => ({
  findUserProfileByUsername: mocks.findUserProfileByUsername,
}));
vi.mock("@/lib/edie-store", () => ({
  acceptSpaceInvitation: mocks.acceptSpaceInvitation,
  addSpaceMember: mocks.addSpaceMember,
  createTeacherSpace: vi.fn(),
  getTeacherSpace: mocks.getTeacherSpace,
  listSpaceMembers: mocks.listSpaceMembers,
  normalizeSpaceCode: (value: string) => value.trim().toLowerCase(),
  updateSpaceMemberRole: mocks.updateSpaceMemberRole,
}));
vi.mock("@/lib/edie-store-model", () => ({
  normalizeSpaceEmail: (value: string) => value.trim().toLowerCase(),
}));
vi.mock("@/lib/space-member-identity", () => ({
  parseMemberInviteIdentity: (value: FormDataEntryValue | null) => {
    const identity = String(value ?? "").trim();
    if (!identity) return { ok: false, message: "invalid" };
    if (identity.startsWith("@") || !identity.includes("@")) {
      return {
        ok: true,
        kind: "username",
        username: identity.replace(/^@/, "").toLowerCase(),
      };
    }
    return { ok: true, kind: "email", email: identity.toLowerCase() };
  },
}));

import { transferSpaceOwnership } from "./actions";

function transferForm(ownerIdentity: string) {
  const formData = new FormData();
  formData.set("spaceCode", "stats-101");
  formData.set("ownerIdentity", ownerIdentity);
  return formData;
}

describe("transferSpaceOwnership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentTeacher.mockResolvedValue({
      id: "admin-1",
      name: "Admin",
      email: "admin@example.com",
      emailVerified: true,
      image: null,
      username: "admin_user",
      displayUsername: "Admin_User",
    });
    mocks.isAdminTeacher.mockReturnValue(true);
    mocks.isAdminAuthenticated.mockResolvedValue(true);
    mocks.getTeacherSpace.mockResolvedValue({ code: "stats-101", name: "Stats" });
    mocks.listSpaceMembers.mockResolvedValue([
      {
        spaceCode: "stats-101",
        email: "old-owner@example.com",
        role: "owner",
        status: "active",
      },
    ]);
    mocks.findUserProfileByUsername.mockResolvedValue({
      id: "user-2",
      email: "new-owner@example.com",
      name: "New Owner",
      image: null,
      username: "new_owner",
      displayUsername: "New_Owner",
    });
  });

  it("resolves a username and transfers using its private email", async () => {
    await expect(
      transferSpaceOwnership(transferForm("@New_Owner")),
    ).rejects.toThrow("redirect:/admin/spaces?transfer=ok&space=stats-101");

    expect(mocks.findUserProfileByUsername).toHaveBeenCalledWith("new_owner");
    expect(mocks.updateSpaceMemberRole).toHaveBeenCalledWith(
      "stats-101",
      "old-owner@example.com",
      "editor",
    );
    expect(mocks.addSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "new-owner@example.com",
      "owner",
      "active",
    );
  });

  it("retains email as a fallback", async () => {
    await expect(
      transferSpaceOwnership(transferForm("person@example.com")),
    ).rejects.toThrow("redirect:/admin/spaces?transfer=ok&space=stats-101");

    expect(mocks.findUserProfileByUsername).not.toHaveBeenCalled();
    expect(mocks.addSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "person@example.com",
      "owner",
      "active",
    );
  });

  it("reports an unknown username without changing ownership", async () => {
    mocks.findUserProfileByUsername.mockResolvedValue(null);

    await expect(
      transferSpaceOwnership(transferForm("missing_user")),
    ).rejects.toThrow(
      "redirect:/admin/spaces?transfer=person-not-found&space=stats-101",
    );
    expect(mocks.updateSpaceMemberRole).not.toHaveBeenCalled();
    expect(mocks.addSpaceMember).not.toHaveBeenCalled();
  });
});
