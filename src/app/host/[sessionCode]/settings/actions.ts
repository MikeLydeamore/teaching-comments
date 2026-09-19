"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addSpaceMember,
  getTeacherSpace,
  normalizeSpaceCode,
  removeSpaceMember,
  updateSpaceMemberRole,
} from "@/lib/edie-store";
import type { SpaceRole } from "@/lib/edie-store-model";
import { getSpaceRoleForUser } from "@/lib/auth-server";
import {
  findUserProfileById,
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
  } else {
    email = identity.email;
  }

  try {
    await addSpaceMember(space.code, email, role === "owner" ? "owner" : "editor");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(settingsPath(space.code, message.includes("already") ? "exists" : "unavailable"));
  }

  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "added"));
}

async function resolveMemberEmail(formData: FormData) {
  const accountId = String(formData.get("accountId") ?? "").trim();

  if (accountId) {
    const profile = await findUserProfileById(accountId);

    if (!profile) {
      throw new Error("Member account unavailable.");
    }

    return profile.email;
  }

  const identity = parseMemberInviteIdentity(formData.get("email"));

  if (!identity.ok || identity.kind !== "email") {
    throw new Error("Member account unavailable.");
  }

  return identity.email;
}

export async function changeSpaceMemberRole(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  let email: string;
  const role = String(formData.get("role") ?? "editor") as SpaceRole;

  try {
    email = await resolveMemberEmail(formData);
    await updateSpaceMemberRole(space.code, email, role === "owner" ? "owner" : "editor");
  } catch {
    redirect(settingsPath(space.code, "unavailable"));
  }
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code));
}

export async function evictSpaceMember(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  let email: string;

  try {
    email = await resolveMemberEmail(formData);
    await removeSpaceMember(space.code, email);
  } catch {
    redirect(settingsPath(space.code, "unavailable"));
  }
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "removed"));
}
