"use server";

import { redirect } from "next/navigation";
import { getSession, normalizeSessionCode } from "@/lib/qwt-store";

export async function joinSession(formData: FormData) {
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));

  if (!sessionCode) {
    redirect("/join?error=missing");
  }

  const session = await getSession(sessionCode);

  if (!session) {
    redirect(`/join?error=not-found&session=${encodeURIComponent(sessionCode)}`);
  }

  if (!session.isOpen) {
    redirect(`/join?error=closed&session=${encodeURIComponent(session.code)}`);
  }

  redirect(`/s/${session.code}`);
}
