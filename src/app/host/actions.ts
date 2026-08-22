"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { normalizeSessionCode, normalizeSpaceCode } from "@/lib/edie-store";

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
