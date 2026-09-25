import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  inviteSpaceMember: vi.fn(),
  findUserProfileByEmail: vi.fn(),
  findUserProfileByUsername: vi.fn(),
  getSpaceRoleForUser: vi.fn(),
  getTeacherSpace: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`);
  }),
  removeSpaceMember: vi.fn(),
  removeSpaceInvitation: vi.fn(),
  revalidatePath: vi.fn(),
  updateSpaceMemberRole: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-server", () => ({
  getSpaceRoleForUser: mocks.getSpaceRoleForUser,
}));
vi.mock("@/lib/auth-users", () => ({
  findUserProfileByEmail: mocks.findUserProfileByEmail,
  findUserProfileByUsername: mocks.findUserProfileByUsername,
}));
vi.mock("@/lib/space-member-identity", () => ({
  parseMemberInviteIdentity: (value: FormDataEntryValue | null) => {
    const identity = String(value ?? "").trim();
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
vi.mock("@/lib/edie-store", () => ({
  inviteSpaceMember: mocks.inviteSpaceMember,
  getTeacherSpace: mocks.getTeacherSpace,
  normalizeSpaceCode: (value: string) => value.trim().toLowerCase(),
  removeSpaceMember: mocks.removeSpaceMember,
  removeSpaceInvitation: mocks.removeSpaceInvitation,
  updateSpaceMemberRole: mocks.updateSpaceMemberRole,
}));

import {
  changeSpaceMemberRole,
  evictSpaceMember,
  inviteSpaceMember,
} from "./actions";

const profile = {
  id: "user-2",
  email: "private@example.com",
  name: "Private Teacher",
  image: null,
  username: "private_teacher",
  displayUsername: "Private_Teacher",
};

function form(values: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("space member settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getTeacherSpace.mockResolvedValue({ code: "stats-101", name: "Stats" });
    mocks.getSpaceRoleForUser.mockResolvedValue("owner");
    mocks.findUserProfileByUsername.mockResolvedValue(profile);
    mocks.findUserProfileByEmail.mockResolvedValue(null);
    mocks.inviteSpaceMember.mockResolvedValue({});
    mocks.updateSpaceMemberRole.mockResolvedValue({});
    mocks.removeSpaceMember.mockResolvedValue(true);
  });

  it("resolves an exact username to the private membership email", async () => {
    await expect(inviteSpaceMember(form({
      spaceCode: "stats-101",
      identity: "@Private_Teacher",
      role: "editor",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=added");

    expect(mocks.findUserProfileByUsername).toHaveBeenCalledWith("private_teacher");
    expect(mocks.inviteSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "private@example.com",
      "user-2",
      "editor",
    );
  });

  it("retains pre-account email invitations", async () => {
    await expect(inviteSpaceMember(form({
      spaceCode: "stats-101",
      identity: "New@Example.com",
      role: "owner",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=added");

    expect(mocks.findUserProfileByUsername).not.toHaveBeenCalled();
    expect(mocks.inviteSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "new@example.com",
      null,
      "owner",
    );
  });

  it("returns a distinct result for an unknown username", async () => {
    mocks.findUserProfileByUsername.mockResolvedValue(null);

    await expect(inviteSpaceMember(form({
      spaceCode: "stats-101",
      identity: "missing_user",
      role: "editor",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=not-found");
    expect(mocks.inviteSpaceMember).not.toHaveBeenCalled();
  });

  it("reports an existing membership without exposing the identity in the URL", async () => {
    mocks.inviteSpaceMember.mockRejectedValue(
      new Error("That person is already a member of this space."),
    );

    await expect(inviteSpaceMember(form({
      spaceCode: "stats-101",
      identity: "@Private_Teacher",
      role: "editor",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=exists");
    expect(mocks.redirect).not.toHaveBeenCalledWith(
      expect.stringContaining("private_teacher"),
    );
  });

  it("fails closed when username lookup is unavailable", async () => {
    mocks.findUserProfileByUsername.mockRejectedValue(
      new Error("auth database unavailable"),
    );

    await expect(inviteSpaceMember(form({
      spaceCode: "stats-101",
      identity: "@Private_Teacher",
      role: "editor",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=unavailable");
    expect(mocks.inviteSpaceMember).not.toHaveBeenCalled();
  });

  it("uses an opaque account ID for role changes", async () => {
    await expect(changeSpaceMemberRole(form({
      spaceCode: "stats-101",
      accountId: "user-2",
      role: "owner",
    }))).rejects.toThrow("redirect:/host/stats-101/settings");

    expect(mocks.updateSpaceMemberRole).toHaveBeenCalledWith(
      "stats-101",
      "user-2",
      "owner",
    );
  });

  it("uses an opaque account ID for removal", async () => {
    await expect(evictSpaceMember(form({
      spaceCode: "stats-101",
      accountId: "user-2",
    }))).rejects.toThrow("redirect:/host/stats-101/settings?member=removed");

    expect(mocks.removeSpaceMember).toHaveBeenCalledWith(
      "stats-101",
      "user-2",
    );
  });
});
