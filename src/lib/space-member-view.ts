import type { MemberProfile } from "./auth-users";
import type { SpaceMember } from "./edie-store-model";

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
  status: SpaceMember["status"];
};

export function buildSpaceMemberView({
  isOwner,
  member,
  profile,
  viewerId,
}: {
  isOwner: boolean;
  member: SpaceMember;
  profile: MemberProfile | null;
  viewerId: string;
}): SpaceMemberView {
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
      isSelf: profile.id === viewerId,
      managementTarget: { accountId: profile.id },
      role: member.role,
      status: member.status,
    };
  }

  return {
    displayName: isOwner
      ? member.email
      : member.status === "pending"
        ? "Pending email invitation"
        : "Ed.ie member",
    handle: null,
    image: null,
    isSelf: false,
    managementTarget: isOwner ? { email: member.email } : null,
    role: member.role,
    status: member.status,
  };
}
