"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getSessionInSpace,
  normalizeSessionCode,
  normalizeSpaceCode,
  normalizeStudentName,
} from "@/lib/qwt-store";
import { studentNameCookieName } from "@/lib/student-name-cookie";

export async function joinSession(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const rawStudentName = String(formData.get("studentName") ?? "");

  if (!spaceCode) {
    redirect("/join?error=space-missing");
  }

  if (!sessionCode) {
    redirect(`/join?error=missing&space=${encodeURIComponent(spaceCode)}`);
  }

  let studentName = "Anonymous";

  try {
    studentName = normalizeStudentName(rawStudentName);
  } catch {
    redirect(
      `/join?error=name-too-long&space=${encodeURIComponent(spaceCode)}&session=${encodeURIComponent(sessionCode)}`,
    );
  }

  const session = await getSessionInSpace(spaceCode, sessionCode);

  if (!session) {
    redirect(
      `/join?error=not-found&space=${encodeURIComponent(spaceCode)}&session=${encodeURIComponent(sessionCode)}`,
    );
  }

  if (!session.isOpen) {
    redirect(
      `/join?error=closed&space=${encodeURIComponent(spaceCode)}&session=${encodeURIComponent(session.code)}`,
    );
  }

  const cookieStore = await cookies();
  const cookieName = studentNameCookieName(session.code);

  if (studentName === "Anonymous") {
    cookieStore.delete(cookieName);
  } else {
    cookieStore.set(cookieName, studentName, {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
    });
  }

  redirect(`/spaces/${spaceCode}/${session.code}`);
}
