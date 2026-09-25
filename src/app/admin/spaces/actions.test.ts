import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addSpaceMember: vi.fn(),
  createTeacherSpaceForOwner: vi.fn(),
  findUserProfileByEmail: vi.fn(),
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
  findUserProfileByEmail: mocks.findUserProfileByEmail,
  findUserProfileByUsername: mocks.findUserProfileByUsername,
}));
vi.mock("@/lib/edie-store", () => ({
  addSpaceMember: mocks.addSpaceMember,
  createTeacherSpaceForOwner: mocks.createTeacherSpaceForOwner,
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

import { createTeachingSpace, transferSpaceOwnership } from "./actions";

function createForm(name = "ETX1100/5900 Business Statistics") {
  const formData = new FormData();
  formData.set("spaceCode", "bstat");
  formData.set("spaceName", name);
  return formData;
}

function createFormForOwner(email: string) {
  const formData = createForm();
  formData.set("ownerEmail", email);
  return formData;
}

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
    mocks.createTeacherSpaceForOwner.mockResolvedValue({
      code: "bstat",
      name: "ETX1100/5900 Business Statistics",
    });
    mocks.addSpaceMember.mockResolvedValue({
      spaceCode: "bstat",
      userId: "admin-1",
      role: "owner",
    });
    mocks.getTeacherSpace.mockResolvedValue({ code: "stats-101", name: "Stats" });
    mocks.listSpaceMembers.mockResolvedValue([
      {
        spaceCode: "stats-101",
        userId: "old-owner-id",
        role: "owner",
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
    mocks.findUserProfileByEmail.mockResolvedValue({
      id: "user-3",
      email: "person@example.com",
      name: "Person",
      image: null,
      username: "person",
      displayUsername: "Person",
    });
  });

  it("creates a space whose name contains a slash and assigns the admin", async () => {
    await expect(createTeachingSpace(createForm())).rejects.toThrow(
      "redirect:/admin/spaces?spaceCreate=created&space=bstat",
    );

    expect(mocks.createTeacherSpaceForOwner).toHaveBeenCalledWith(
      "bstat",
      "ETX1100/5900 Business Statistics",
      { userId: "admin-1", email: "admin@example.com", name: "Admin" },
    );
    expect(mocks.addSpaceMember).not.toHaveBeenCalled();
  });

  it("reports storage failures separately from invalid input", async () => {
    mocks.createTeacherSpaceForOwner.mockRejectedValue(
      new Error('null value in column "pin_hash" violates not-null constraint'),
    );

    await expect(createTeachingSpace(createForm())).rejects.toThrow(
      "redirect:/admin/spaces?spaceCreate=unavailable&space=bstat",
    );
  });

  it("requires a new space owner to have an existing account", async () => {
    mocks.findUserProfileByEmail.mockResolvedValue(null);
    await expect(
      createTeachingSpace(createFormForOwner("missing@example.com")),
    ).rejects.toThrow(
      "redirect:/admin/spaces?spaceCreate=owner-not-found&space=bstat",
    );
    expect(mocks.createTeacherSpaceForOwner).not.toHaveBeenCalled();
  });

  it("reports an atomic creation failure without claiming success", async () => {
    mocks.createTeacherSpaceForOwner.mockRejectedValue(new Error("database unavailable"));

    await expect(createTeachingSpace(createForm())).rejects.toThrow(
      "redirect:/admin/spaces?spaceCreate=unavailable&space=bstat",
    );
  });

  it("resolves a username and transfers using its private email", async () => {
    await expect(
      transferSpaceOwnership(transferForm("@New_Owner")),
    ).rejects.toThrow("redirect:/admin/spaces?transfer=ok&space=stats-101");

    expect(mocks.findUserProfileByUsername).toHaveBeenCalledWith("new_owner");
    expect(mocks.updateSpaceMemberRole).toHaveBeenCalledWith(
      "stats-101",
      "old-owner-id",
      "editor",
    );
    expect(mocks.addSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "user-2",
      "new-owner@example.com",
      "owner",
    );
  });

  it("retains email as a fallback", async () => {
    await expect(
      transferSpaceOwnership(transferForm("person@example.com")),
    ).rejects.toThrow("redirect:/admin/spaces?transfer=ok&space=stats-101");

    expect(mocks.findUserProfileByUsername).not.toHaveBeenCalled();
    expect(mocks.addSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "user-3",
      "person@example.com",
      "owner",
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
