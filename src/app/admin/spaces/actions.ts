"use server";

import { redirect } from "next/navigation";
import {
  hashTeacherSpacePin,
  isAdminAuthenticated,
  isValidAdminPin,
  setAdminAuthCookie,
} from "@/lib/teacher-auth";
import {
  normalizeSpaceCode,
  updateTeacherSpacePinHash,
} from "@/lib/qwt-store";

function adminSpacesResetPath(status: string, spaceCode = "") {
  const params = new URLSearchParams({ pinReset: status });

  if (spaceCode) {
    params.set("space", spaceCode);
  }

  return `/admin/spaces?${params.toString()}`;
}

export async function unlockAdminSpaces(formData: FormData) {
  const adminPin = String(formData.get("adminPin") ?? "");

  if (isValidAdminPin(adminPin)) {
    await setAdminAuthCookie();
    redirect("/admin/spaces?spacesAuth=ok");
  }

  redirect("/admin/spaces?spacesAuth=failed");
}

export async function resetTeacherSpacePin(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const newPin = String(formData.get("newPin") ?? "");

  if (!(await isAdminAuthenticated())) {
    redirect("/admin/spaces?spacesAuth=failed");
  }

  if (!spaceCode) {
    redirect(adminSpacesResetPath("missing"));
  }

  let pinHash: string;

  try {
    pinHash = hashTeacherSpacePin(newPin);
  } catch {
    redirect(adminSpacesResetPath("invalid", spaceCode));
  }

  const updated = await updateTeacherSpacePinHash(spaceCode, pinHash);

  if (!updated) {
    redirect(adminSpacesResetPath("not-found", spaceCode));
  }

  redirect(adminSpacesResetPath("updated", spaceCode));
}
