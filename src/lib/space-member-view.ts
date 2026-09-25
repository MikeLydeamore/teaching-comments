import type { MemberProfile } from "./auth-users";
import type { SpaceInvitationRecord, SpaceMember } from "./edie-store-model";

export type SpaceMemberManagementTarget =
  | { accountId: string; email?: never }
  | { accountId?: never; email: string };

export type SpaceMemberView = {
  displayName: string;
  handle: string | null;
  image: string | null;
  isSelf: boolean;
  managementTarget: SpaceMemberManagementTarget | null;
  role: SpaceMember["role"];
  status: "active" | "pending";
};

export function buildSpaceMemberView({
  isOwner,
  member,
  profile,
  viewerId,
}: {
  isOwner: boolean;
  member: SpaceMember | SpaceInvitationRecord;
  profile: MemberProfile | null;
  viewerId: string;
}): SpaceMemberView {
  const isInvitation = "email" in member;

  if (profile) {
    const profileName = profile.name?.trim();
    const safeDisplayName =
      profileName && profileName.toLowerCase() !== profile.email.toLowerCase()
        ? profileName
        : profile.displayUsername || "Ed.ie member";

    return {
      displayName: safeDisplayName,
      handle: profile.displayUsername ? `@${profile.displayUsername}` : null,
      image: profile.image,
      isSelf: !isInvitation && profile.id === viewerId,
      managementTarget: isInvitation
        ? { email: member.email }
        : { accountId: profile.id },
      role: member.role,
      status: isInvitation ? "pending" : "active",
    };
  }

  return {
    displayName: isOwner
      ? isInvitation
        ? member.email
        : "Ed.ie member"
      : isInvitation
        ? "Pending email invitation"
        : "Ed.ie member",
    handle: null,
    image: null,
    isSelf: false,
    managementTarget: isOwner
      ? isInvitation
        ? { email: member.email }
        : { accountId: member.userId }
      : null,
    role: member.role,
    status: isInvitation ? "pending" : "active",
  };
}
