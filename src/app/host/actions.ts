"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getCurrentTeacher } from "@/lib/auth-server";
import {
  acceptSpaceInvitation as acceptInvitation,
  createTeacherSpaceForOwner,
  declineSpaceInvitation as declineInvitation,
  ensurePersonalOrganization,
  getSpaceMemberRole,
  getTeacherSpace,
  leaveSpace,
  normalizeSessionCode,
  normalizeSpaceCode,
} from "@/lib/edie-store";
import { EntitlementLimitError, entitlementsForOrganization } from "@/lib/entitlements";
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

  if (!teacher.username) {
    redirect("/host");
  }

  return teacher;
}

export async function acceptSpaceInvitation(formData: FormData) {
  const teacher = await requireTeacher("/host/invitations");
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  let accepted = false;
  if (spaceCode) {
    const space = await getTeacherSpace(spaceCode);
    try {
      if (space) {
        const entitlements = await entitlementsForOrganization(space.organizationId);
        accepted = await acceptInvitation(
          spaceCode,
          teacher.id,
          teacher.emailVerified ? teacher.email : null,
          entitlements.limits.teacherSeats,
        );
      }
    } catch (error) {
      if (error instanceof EntitlementLimitError) {
        redirect(invitationsPath("seat-limit"));
      }
      throw error;
    }
  }

  revalidatePath("/host");
  revalidatePath("/host/invitations");
  redirect(invitationsPath(accepted ? "accepted" : "unavailable"));
}

export async function declineSpaceInvitation(formData: FormData) {
  const teacher = await requireTeacher("/host/invitations");
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const declined = spaceCode
    ? await declineInvitation(
        spaceCode,
        teacher.id,
        teacher.emailVerified ? teacher.email : null,
      )
    : false;

  revalidatePath("/host");
  revalidatePath("/host/invitations");
  redirect(invitationsPath(declined ? "declined" : "unavailable"));
}

export async function leaveHostedSpace(formData: FormData) {
  const teacher = await requireTeacher();
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const role = spaceCode
    ? await getSpaceMemberRole(spaceCode, teacher.id)
    : null;

  const left = role
    ? await leaveSpace(spaceCode, teacher.id)
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

export async function createHostedSpace(formData: FormData) {
  const teacher = await requireTeacher();
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const name = String(formData.get("spaceName") ?? "");

  if (!spaceCode) {
    redirect("/host?spaceCreate=invalid");
  }

  try {
    const organization = await ensurePersonalOrganization(
      teacher.id,
      teacher.name ?? teacher.displayUsername ?? "Teacher",
    );
    const entitlements = await entitlementsForOrganization(organization.id);
    await createTeacherSpaceForOwner(
      spaceCode,
      name,
      {
        userId: teacher.id,
        name: teacher.name ?? teacher.displayUsername ?? "Teacher",
      },
      entitlements.limits.ownedSpaces,
    );
  } catch (error) {
    if (error instanceof EntitlementLimitError) {
      redirect("/host?spaceCreate=space-limit");
    }
    const message = error instanceof Error ? error.message : "";
    const status = message.includes("already exists")
      ? "exists"
      : message.startsWith("Space name") || message.startsWith("Space code")
        ? "invalid"
        : "unavailable";
    redirect(`/host?spaceCreate=${status}`);
  }

  revalidatePath("/host");
  redirect(`/host/${spaceCode}`);
}
