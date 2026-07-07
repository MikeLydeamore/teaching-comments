"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getSession, normalizeSessionCode, normalizeStudentName } from "@/lib/qwt-store";
import { studentNameCookieName } from "@/lib/student-name-cookie";

export async function joinSession(formData: FormData) {
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const rawStudentName = String(formData.get("studentName") ?? "");

  if (!sessionCode) {
    redirect("/join?error=missing");
  }

  let studentName = "Anonymous";

  try {
    studentName = normalizeStudentName(rawStudentName);
  } catch {
    redirect(`/join?error=name-too-long&session=${encodeURIComponent(sessionCode)}`);
  }

  const session = await getSession(sessionCode);

  if (!session) {
    redirect(`/join?error=not-found&session=${encodeURIComponent(sessionCode)}`);
  }

  if (!session.isOpen) {
    redirect(`/join?error=closed&session=${encodeURIComponent(session.code)}`);
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

  redirect(`/s/${session.code}`);
}
