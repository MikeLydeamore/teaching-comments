"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getTeacherSpace,
  inviteSpaceMember as createSpaceInvitation,
  normalizeSpaceCode,
  removeSpaceMember,
  removeSpaceInvitation,
  updateSpaceMemberRole,
} from "@/lib/edie-store";
import type { SpaceRole } from "@/lib/edie-store-model";
import { getSpaceRoleForUser } from "@/lib/auth-server";
import {
  findUserProfileByEmail,
  findUserProfileByUsername,
} from "@/lib/auth-users";
import { parseMemberInviteIdentity } from "@/lib/space-member-identity";

function settingsPath(spaceCode: string, status = "") {
  const params = new URLSearchParams();

  if (status) {
    params.set("member", status);
  }

  const query = params.toString();
  return `/host/${spaceCode}/settings${query ? `?${query}` : ""}`;
}

async function requireOwner(spaceCode: string) {
  const normalized = normalizeSpaceCode(spaceCode);
  const space = await getTeacherSpace(normalized);

  if (!space) {
    redirect("/host");
  }

  const role = await getSpaceRoleForUser(space.code);

  if (role !== "owner") {
    redirect(`/host/${space.code}`);
  }

  return space;
}

export async function inviteSpaceMember(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  const identity = parseMemberInviteIdentity(formData.get("identity"));
  const role = (String(formData.get("role") ?? "editor") || "editor") as SpaceRole;

  if (!identity.ok) {
    redirect(settingsPath(space.code, "invalid"));
  }

  let email: string;
  let userId: string | null = null;

  if (identity.kind === "username") {
    let profile;

    try {
      profile = await findUserProfileByUsername(identity.username);
    } catch {
      redirect(settingsPath(space.code, "unavailable"));
    }

    if (!profile) {
      redirect(settingsPath(space.code, "not-found"));
    }

    email = profile.email;
    userId = profile.id;
  } else {
    email = identity.email;
    try {
      userId = (await findUserProfileByEmail(email))?.id ?? null;
    } catch {
      // Email invitations remain valid when the optional account lookup is
      // unavailable; acceptance binds the invitation to the signed-in user.
      userId = null;
    }
  }

  try {
    await createSpaceInvitation(
      space.code,
      email,
      userId,
      role === "owner" ? "owner" : "editor",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(settingsPath(space.code, message.includes("already") ? "exists" : "unavailable"));
  }

  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "added"));
}

function resolveMemberUserId(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "").trim();
  if (!accountId) throw new Error("Member account unavailable.");
  return accountId;
}

export async function changeSpaceMemberRole(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  let userId: string;
  const role = String(formData.get("role") ?? "editor") as SpaceRole;

  try {
    userId = resolveMemberUserId(formData);
    await updateSpaceMemberRole(space.code, userId, role === "owner" ? "owner" : "editor");
  } catch {
    redirect(settingsPath(space.code, "unavailable"));
  }
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code));
}

export async function evictSpaceMember(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  try {
    const accountId = String(formData.get("accountId") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();

    if (accountId) {
      await removeSpaceMember(space.code, accountId);
    } else if (email) {
      await removeSpaceInvitation(space.code, email);
    } else {
      throw new Error("Member account unavailable.");
    }
  } catch {
    redirect(settingsPath(space.code, "unavailable"));
  }
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "removed"));
}
