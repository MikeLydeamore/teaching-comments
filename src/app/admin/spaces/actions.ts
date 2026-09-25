"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addSpaceMember,
  createTeacherSpaceForOwner,
  getTeacherSpace,
  listSpaceMembers,
  normalizeSpaceCode,
  updateSpaceMemberRole,
} from "@/lib/edie-store";
import { normalizeSpaceEmail } from "@/lib/edie-store-model";
import {
  getCurrentTeacher,
  isAdminAuthenticated,
  isAdminTeacher,
} from "@/lib/auth-server";
import {
  findUserProfileByEmail,
  findUserProfileByUsername,
  type MemberProfile,
} from "@/lib/auth-users";
import { parseMemberInviteIdentity } from "@/lib/space-member-identity";

function adminSpacesPath(status: string, spaceCode = "") {
  const params = new URLSearchParams({ spaceCreate: status });

  if (spaceCode) {
    params.set("space", spaceCode);
  }

  return `/admin/spaces?${params.toString()}`;
}

function claimPath(status: string, spaceCode: string) {
  const params = new URLSearchParams({ claim: status, space: spaceCode });
  return `/admin/spaces?${params.toString()}`;
}

function transferPath(status: string, spaceCode: string) {
  const params = new URLSearchParams({ transfer: status, space: spaceCode });
  return `/admin/spaces?${params.toString()}`;
}

async function requireAdmin() {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect("/auth/login?returnTo=%2Fadmin%2Fspaces");
  }

  if (!isAdminTeacher(teacher) || !(await isAdminAuthenticated())) {
    redirect(adminSpacesPath("forbidden"));
  }

  return teacher;
}

export async function createTeachingSpace(formData: FormData) {
  const admin = await requireAdmin();

  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const name = String(formData.get("spaceName") ?? "");
  const rawOwnerEmail = String(formData.get("ownerEmail") ?? "").trim();

  if (!spaceCode) {
    redirect(adminSpacesPath("missing"));
  }

  let owner: MemberProfile = {
    id: admin.id,
    email: admin.email,
    name: admin.name,
    image: admin.image,
    username: admin.username,
    displayUsername: admin.displayUsername,
  };

  if (rawOwnerEmail) {
    let ownerEmail: string;
    try {
      ownerEmail = normalizeSpaceEmail(rawOwnerEmail);
    } catch {
      redirect(adminSpacesPath("owner-invalid", spaceCode));
    }
    let profile;
    try {
      profile = await findUserProfileByEmail(ownerEmail);
    } catch {
      redirect(adminSpacesPath("unavailable", spaceCode));
    }
    if (!profile) redirect(adminSpacesPath("owner-not-found", spaceCode));
    owner = profile;
  }

  try {
    await createTeacherSpaceForOwner(spaceCode, name || spaceCode, {
      userId: owner.id,
      email: owner.email,
      name: owner.name ?? owner.displayUsername ?? "Teacher",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = message.includes("already exists")
      ? "exists"
      : message.startsWith("Space name") || message.startsWith("Space code")
        ? "invalid"
        : "unavailable";
    redirect(adminSpacesPath(reason, spaceCode));
  }

  redirect(adminSpacesPath("created", spaceCode));
}

/** Lets an admin claim an unowned space as its owner. */
export async function claimTeacherSpace(formData: FormData) {
  const admin = await requireAdmin();
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));

  const existingMembers = await listSpaceMembers(spaceCode);

  if (existingMembers.some(
    (member) => member.role === "owner",
  )) {
    redirect(claimPath("claimed", spaceCode));
  }

  try {
    await addSpaceMember(spaceCode, admin.id, admin.email, "owner");
  } catch {
    redirect(claimPath("not-found", spaceCode));
  }

  redirect(claimPath("ok", spaceCode));
}

/** Sets exactly one accountable owner; previous owners become editors. */
export async function transferSpaceOwnership(formData: FormData) {
  await requireAdmin();

  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const identity = parseMemberInviteIdentity(formData.get("ownerIdentity"));
  let ownerProfile;

  if (!identity.ok) {
    redirect(transferPath("invalid", spaceCode));
  }

  if (identity.kind === "username") {
    let profile;

    try {
      profile = await findUserProfileByUsername(identity.username);
    } catch {
      redirect(transferPath("unavailable", spaceCode));
    }

    if (!profile) {
      redirect(transferPath("person-not-found", spaceCode));
    }

    ownerProfile = profile;
  } else {
    try {
      ownerProfile = await findUserProfileByEmail(identity.email);
    } catch {
      redirect(transferPath("unavailable", spaceCode));
    }
    if (!ownerProfile) redirect(transferPath("person-not-found", spaceCode));
  }

  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    redirect(transferPath("not-found", spaceCode));
  }

  const members = await listSpaceMembers(space.code);

  for (const member of members) {
    if (
      member.role === "owner" &&
      member.userId !== ownerProfile.id
    ) {
      await updateSpaceMemberRole(space.code, member.userId, "editor");
    }
  }

  const target = members.find((member) => member.userId === ownerProfile.id);

  if (target) {
    if (target.role !== "owner") {
      await updateSpaceMemberRole(space.code, ownerProfile.id, "owner");
    }
  } else {
    await addSpaceMember(
      space.code,
      ownerProfile.id,
      ownerProfile.email,
      "owner",
    );
  }

  revalidatePath("/admin/spaces");
  redirect(transferPath("ok", space.code));
}
