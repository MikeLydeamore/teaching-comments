"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  acceptSpaceInvitation,
  addSpaceMember,
  createTeacherSpace,
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

  let ownerEmail = admin.email;

  if (rawOwnerEmail) {
    try {
      ownerEmail = normalizeSpaceEmail(rawOwnerEmail);
    } catch {
      redirect(adminSpacesPath("owner-invalid", spaceCode));
    }
  }

  try {
    const space = await createTeacherSpace(spaceCode, name || spaceCode);
    await addSpaceMember(space.code, ownerEmail, "owner", "active");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const reason = message.includes("already exists")
      ? "exists"
      : "invalid";
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
    (member) => member.role === "owner" && member.status === "active",
  )) {
    redirect(claimPath("claimed", spaceCode));
  }

  try {
    await addSpaceMember(spaceCode, admin.email, "owner", "active");
  } catch {
    redirect(claimPath("not-found", spaceCode));
  }

  redirect(claimPath("ok", spaceCode));
}

/** Sets exactly one accountable owner; previous owners become editors. */
export async function transferSpaceOwnership(formData: FormData) {
  await requireAdmin();

  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  let ownerEmail: string;

  try {
    ownerEmail = normalizeSpaceEmail(String(formData.get("ownerEmail") ?? ""));
  } catch {
    redirect(transferPath("invalid", spaceCode));
  }

  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    redirect(transferPath("not-found", spaceCode));
  }

  const members = await listSpaceMembers(space.code);

  for (const member of members) {
    if (
      member.role === "owner" &&
      member.status === "active" &&
      member.email !== ownerEmail
    ) {
      await updateSpaceMemberRole(space.code, member.email, "editor");
    }
  }

  const target = members.find((member) => member.email === ownerEmail);

  if (target) {
    if (target.role !== "owner") {
      await updateSpaceMemberRole(space.code, ownerEmail, "owner");
    }
    if (target.status === "pending") {
      await acceptSpaceInvitation(space.code, ownerEmail);
    }
  } else {
    await addSpaceMember(space.code, ownerEmail, "owner", "active");
  }

  revalidatePath("/admin/spaces");
  redirect(transferPath("ok", space.code));
}
