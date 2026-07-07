"use server";

import { redirect } from "next/navigation";
import { clearTeacherAuthCookie, isTeacherAuthenticated, isValidTeacherPin, setTeacherAuthCookie } from "@/lib/teacher-auth";
import { normalizeSessionCode } from "@/lib/qwt-store";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/teacher";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/teacher";
}

export async function enterTeacherSession(formData: FormData) {
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const pin = String(formData.get("pin") ?? "");
  const target = `/teacher/${sessionCode || "demo-lecture"}`;
  const alreadyAuthenticated = await isTeacherAuthenticated();

  if (alreadyAuthenticated || isValidTeacherPin(pin)) {
    if (!alreadyAuthenticated) {
      await setTeacherAuthCookie();
    }

    redirect(target);
  }

  redirect(`/teacher?auth=failed&session=${encodeURIComponent(sessionCode)}`);
}

export async function loginTeacher(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const next = safeNextPath(formData.get("next"));

  if (isValidTeacherPin(pin)) {
    await setTeacherAuthCookie();
    redirect(next);
  }

  redirect(`${next}?auth=failed`);
}

export async function logoutTeacher(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  await clearTeacherAuthCookie();
  redirect(next);
}
