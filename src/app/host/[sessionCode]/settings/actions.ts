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

function settingsPath(spaceCode: string, status = "", email = "") {
  const params = new URLSearchParams();

  if (status) {
    params.set("member", status);
  }

  if (email) {
    params.set("email", email);
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
  const email = String(formData.get("email") ?? "").trim();
  const role = (String(formData.get("role") ?? "editor") || "editor") as SpaceRole;

  try {
    await addSpaceMember(space.code, email, role === "owner" ? "owner" : "editor");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    redirect(settingsPath(space.code, message.includes("already") ? "exists" : "invalid", email));
  }

  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "added"));
}

export async function changeSpaceMemberRole(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  const email = String(formData.get("email") ?? "");
  const role = String(formData.get("role") ?? "editor") as SpaceRole;

  await updateSpaceMemberRole(space.code, email, role === "owner" ? "owner" : "editor");
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code));
}

export async function evictSpaceMember(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const space = await requireOwner(spaceCode);
  const email = String(formData.get("email") ?? "");

  await removeSpaceMember(space.code, email);
  revalidatePath(settingsPath(space.code));
  redirect(settingsPath(space.code, "removed"));
}
