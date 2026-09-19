"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getCurrentTeacher } from "@/lib/auth-server";
import {
  acceptSpaceInvitation as acceptInvitation,
  declineSpaceInvitation as declineInvitation,
  getSpaceMemberRole,
  leaveSpace,
  normalizeSessionCode,
  normalizeSpaceCode,
} from "@/lib/edie-store";
import { loginRedirectPath } from "@/lib/teacher-session-auth";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/host";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/host";
}

export async function enterTeacherSession(formData: FormData) {
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const target = spaceCode
    ? `/host/${spaceCode}/${sessionCode || "demo-lecture"}`
    : `/host/${sessionCode || "demo-lecture"}`;

  redirect(target);
}

export async function logoutTeacher(formData: FormData) {
  await getAuth().api.signOut({ headers: await headers() });
  redirect(safeNextPath(formData.get("next")));
}

function hostPath(status = "") {
  return status ? `/host?membership=${encodeURIComponent(status)}` : "/host";
}

function invitationsPath(status = "") {
  return status
    ? `/host/invitations?invitation=${encodeURIComponent(status)}`
    : "/host/invitations";
}

async function requireTeacher(returnTo = "/host") {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    redirect(loginRedirectPath(returnTo));
  }

  return teacher;
}

export async function acceptSpaceInvitation(formData: FormData) {
  const teacher = await requireTeacher("/host/invitations");
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const accepted = spaceCode
    ? await acceptInvitation(spaceCode, teacher.email)
    : false;

  revalidatePath("/host");
  revalidatePath("/host/invitations");
  redirect(invitationsPath(accepted ? "accepted" : "unavailable"));
}

export async function declineSpaceInvitation(formData: FormData) {
  const teacher = await requireTeacher("/host/invitations");
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const declined = spaceCode
    ? await declineInvitation(spaceCode, teacher.email)
    : false;

  revalidatePath("/host");
  revalidatePath("/host/invitations");
  redirect(invitationsPath(declined ? "declined" : "unavailable"));
}

export async function leaveHostedSpace(formData: FormData) {
  const teacher = await requireTeacher();
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const role = spaceCode
    ? await getSpaceMemberRole(spaceCode, teacher.email)
    : null;

  const left = role
    ? await leaveSpace(spaceCode, teacher.email)
    : false;

  revalidatePath("/host");
  redirect(hostPath(
    left
      ? "left"
      : role === "owner"
        ? "owner-cannot-leave"
        : "membership-unavailable",
  ));
}
