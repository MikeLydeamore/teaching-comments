import { describe, expect, it } from "vitest";
import type { MemberProfile } from "./auth-users";
import type { SpaceMember } from "./edie-store-model";
import { buildSpaceMemberView } from "./space-member-view";

const member: SpaceMember = {
  spaceCode: "stats-101",
  email: "private@example.com",
  role: "editor",
  status: "active",
  createdAt: "2026-09-19T00:00:00.000Z",
};

const profile: MemberProfile = {
  id: "user-1",
  email: member.email,
  name: "Jane Smith",
  image: null,
  username: "jane_smith",
  displayUsername: "Jane_Smith",
};

describe("buildSpaceMemberView", () => {
  it("omits account-backed email and uses an opaque account target", () => {
    const view = buildSpaceMemberView({
      isOwner: true,
      member,
      profile,
      viewerId: "owner-1",
    });

    expect(view).toMatchObject({
      displayName: "Jane Smith",
      handle: "@Jane_Smith",
      managementTarget: { accountId: "user-1" },
    });
    expect(JSON.stringify(view)).not.toContain(member.email);
  });

  it("does not trust an email-shaped OAuth profile name", () => {
    const view = buildSpaceMemberView({
      isOwner: true,
      member,
      profile: { ...profile, name: member.email },
      viewerId: "owner-1",
    });

    expect(view.displayName).toBe("Jane_Smith");
    expect(JSON.stringify(view)).not.toContain(member.email);
  });

  it("shows an orphan email invitation only to an owner", () => {
    expect(buildSpaceMemberView({
      isOwner: true,
      member: { ...member, status: "pending" },
      profile: null,
      viewerId: "owner-1",
    }).displayName).toBe(member.email);

    const editorView = buildSpaceMemberView({
      isOwner: false,
      member: { ...member, status: "pending" },
      profile: null,
      viewerId: "editor-1",
    });
    expect(editorView.displayName).toBe("Pending email invitation");
    expect(editorView.managementTarget).toBeNull();
    expect(JSON.stringify(editorView)).not.toContain(member.email);
  });
});
