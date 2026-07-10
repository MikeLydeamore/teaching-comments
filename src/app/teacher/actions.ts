"use server";

import { redirect } from "next/navigation";
import {
  clearTeacherAuthCookie,
  hashTeacherSpacePin,
  isTeacherAuthenticated,
  isTeacherSpaceCookieValid,
  isValidAdminPin,
  isValidTeacherPin,
  isValidTeacherSpacePin,
  setTeacherAuthCookie,
  setTeacherSpaceAuthCookie,
} from "@/lib/teacher-auth";
import {
  createTeacherSpace,
  getTeacherSpace,
  normalizeSessionCode,
  normalizeSpaceCode,
} from "@/lib/qwt-store";

function safeNextPath(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "/teacher";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/teacher";
}

function authFailedPath(next: string) {
  return `${next}${next.includes("?") ? "&" : "?"}auth=failed`;
}

function teacherSpacePath(spaceCode: string) {
  return `/teacher/${spaceCode || "default"}`;
}

function teacherSessionPath(spaceCode: string, sessionCode: string) {
  return `${teacherSpacePath(spaceCode)}/${sessionCode || "demo-lecture"}`;
}

export async function createTeachingSpace(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const name = String(formData.get("spaceName") ?? "");
  const spacePin = String(formData.get("spacePin") ?? "");
  const adminPin = String(formData.get("adminPin") ?? "");
  let space: Awaited<ReturnType<typeof createTeacherSpace>>;

  if (!spaceCode) {
    redirect("/teacher?spaceCreate=missing");
  }

  if (!isValidAdminPin(adminPin)) {
    redirect(`/teacher?spaceCreate=admin-failed&space=${encodeURIComponent(spaceCode)}`);
  }

  try {
    space = await createTeacherSpace(
      spaceCode,
      name || spaceCode,
      hashTeacherSpacePin(spacePin),
    );
  } catch (error) {
    const reason =
      error instanceof Error && error.message.includes("already exists")
        ? "exists"
        : "invalid";
    redirect(`/teacher?spaceCreate=${reason}&space=${encodeURIComponent(spaceCode)}`);
  }

  await setTeacherSpaceAuthCookie(space);
  redirect(teacherSpacePath(space.code));
}

export async function enterTeacherSpace(formData: FormData) {
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const pin = String(formData.get("pin") ?? "");

  if (!spaceCode) {
    redirect("/teacher?spaceAuth=missing");
  }

  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    redirect(`/teacher?spaceAuth=not-found&space=${encodeURIComponent(spaceCode)}`);
  }

  if (isValidTeacherSpacePin(pin, space.pinHash)) {
    await setTeacherSpaceAuthCookie(space);
    redirect(teacherSpacePath(space.code));
  }

  redirect(`/teacher?spaceAuth=failed&space=${encodeURIComponent(spaceCode)}`);
}

export async function enterTeacherSession(formData: FormData) {
  const sessionCode = normalizeSessionCode(String(formData.get("sessionCode") ?? ""));
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));
  const pin = String(formData.get("pin") ?? "");
  const target = spaceCode
    ? teacherSessionPath(spaceCode, sessionCode)
    : `/teacher/${sessionCode || "demo-lecture"}`;
  const space = spaceCode ? await getTeacherSpace(spaceCode) : null;

  if (spaceCode && !space) {
    redirect(`/teacher?spaceAuth=not-found&space=${encodeURIComponent(spaceCode)}`);
  }

  const alreadyAuthenticated = space
    ? await isTeacherSpaceCookieValid(space)
    : await isTeacherAuthenticated();

  if (
    alreadyAuthenticated ||
    (space
      ? isValidTeacherSpacePin(pin, space.pinHash)
      : isValidTeacherPin(pin))
  ) {
    if (!alreadyAuthenticated) {
      if (space) {
        await setTeacherSpaceAuthCookie(space);
      } else {
        await setTeacherAuthCookie();
      }
    }

    redirect(target);
  }

  redirect(
    spaceCode
      ? `/teacher/${spaceCode}?auth=failed&session=${encodeURIComponent(sessionCode)}`
      : `/teacher?auth=failed&session=${encodeURIComponent(sessionCode)}`,
  );
}

export async function loginTeacher(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");
  const next = safeNextPath(formData.get("next"));
  const spaceCode = normalizeSpaceCode(String(formData.get("spaceCode") ?? ""));

  if (spaceCode) {
    const space = await getTeacherSpace(spaceCode);

    if (space && isValidTeacherSpacePin(pin, space.pinHash)) {
      await setTeacherSpaceAuthCookie(space);
      redirect(next);
    }

    redirect(authFailedPath(next));
  }

  if (isValidTeacherPin(pin)) {
    await setTeacherAuthCookie();
    redirect(next);
  }

  redirect(authFailedPath(next));
}

export async function logoutTeacher(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  await clearTeacherAuthCookie();
  redirect(next);
}
