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
import { studentConsentCookieName } from "@/lib/student-consent-cookie";

export async function joinSession(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const rawStudentName = String(formData.get("studentName") ?? "");
  const privacyAccepted = formData.get("privacyAccepted") === "on";

  if (!spaceCode) {
    redirect("/join?error=space-missing");
  }

  if (!sessionCode) {
    redirect(`/join?error=missing&space=${encodeURIComponent(spaceCode)}`);
  }

  if (!privacyAccepted) {
    redirect(
      `/join?error=privacy-required&space=${encodeURIComponent(spaceCode)}&session=${encodeURIComponent(sessionCode)}`,
    );
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

  cookieStore.set(studentConsentCookieName(session.code), "accepted", {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  redirect(`/spaces/${spaceCode}/${session.code}`);
}
