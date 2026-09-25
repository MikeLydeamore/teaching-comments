import { describe, expect, it } from "vitest";
import type { MemberProfile } from "./auth-users";
import type { SpaceInvitationRecord, SpaceMember } from "./edie-store-model";
import { buildSpaceMemberView } from "./space-member-view";

const member: SpaceMember = {
  spaceCode: "stats-101", userId: "user-1", role: "editor",
  createdAt: "2026-09-19T00:00:00.000Z",
};
const profile: MemberProfile = {
  id: "user-1", email: "private@example.com", name: "Jane Smith", image: null,
  username: "jane_smith", displayUsername: "Jane_Smith",
};
const invitation: SpaceInvitationRecord = {
  spaceCode: "stats-101", email: "invited@example.com", userId: null,
  role: "editor", createdAt: "2026-09-19T00:00:00.000Z",
};

describe("buildSpaceMemberView", () => {
  it("uses an opaque user target and never exposes an active member email", () => {
    const view = buildSpaceMemberView({ isOwner: true, member, profile, viewerId: "owner-1" });
    expect(view).toMatchObject({ displayName: "Jane Smith", handle: "@Jane_Smith", managementTarget: { accountId: "user-1" }, status: "active" });
    expect(JSON.stringify(view)).not.toContain(profile.email);
  });

  it("shows an email invitation only to an owner", () => {
    const ownerView = buildSpaceMemberView({ isOwner: true, member: invitation, profile: null, viewerId: "owner-1" });
    expect(ownerView).toMatchObject({ displayName: invitation.email, managementTarget: { email: invitation.email }, status: "pending" });

    const editorView = buildSpaceMemberView({ isOwner: false, member: invitation, profile: null, viewerId: "editor-1" });
    expect(editorView.displayName).toBe("Pending email invitation");
    expect(editorView.managementTarget).toBeNull();
    expect(JSON.stringify(editorView)).not.toContain(invitation.email);
  });

  it("keeps an orphaned active account removable without exposing email", () => {
    const view = buildSpaceMemberView({
      isOwner: true,
      member,
      profile: null,
      viewerId: "owner-1",
    });
    expect(view).toMatchObject({
      displayName: "Ed.ie member",
      managementTarget: { accountId: "user-1" },
      status: "active",
    });
  });
});
