"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentTeacher } from "@/lib/auth-server";
import {
  getOrganizationMemberRole,
  getPersonalOrganization,
  removeOrganizationMember,
} from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";

function organizationPath(status = "") {
  return status
    ? `/host/organization?member=${encodeURIComponent(status)}`
    : "/host/organization";
}

export async function removeOrganizationSeat(formData: FormData) {
  const teacher = await getCurrentTeacher();
  if (!teacher) redirect(loginRedirectPath("/host/organization"));

  const organization = await getPersonalOrganization(teacher.id);
  if (!organization) redirect("/host");

  const role = await getOrganizationMemberRole(organization.id, teacher.id);
  if (role !== "owner") redirect("/host");

  const userId = String(formData.get("accountId") ?? "").trim();
  if (!userId || userId === teacher.id) {
    redirect(organizationPath("protected"));
  }

  let removed = false;
  try {
    removed = await removeOrganizationMember(organization.id, userId);
  } catch {
    redirect(organizationPath("unavailable"));
  }

  revalidatePath("/host");
  revalidatePath("/host/organization");
  redirect(organizationPath(removed ? "removed" : "protected"));
}
