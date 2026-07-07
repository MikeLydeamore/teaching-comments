import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const TEACHER_COOKIE = "qwt_teacher";

const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const DEFAULT_DEV_PIN = "teach123";

function teacherPin() {
  return process.env.TEACHER_PIN?.trim() || DEFAULT_DEV_PIN;
}

export function isDefaultTeacherPin() {
  return teacherPin() === DEFAULT_DEV_PIN;
}

export function isValidTeacherPin(pin: string) {
  return pin.trim() === teacherPin();
}

function teacherToken() {
  return createHash("sha256")
    .update(`quick-write-teacher:${teacherPin()}`)
    .digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export async function isTeacherAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(TEACHER_COOKIE)?.value;

  return Boolean(value && safeEqual(value, teacherToken()));
}

export async function setTeacherAuthCookie() {
  const cookieStore = await cookies();

  cookieStore.set(TEACHER_COOKIE, teacherToken(), {
    httpOnly: true,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearTeacherAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_COOKIE);
}

export async function teacherUnauthorizedResponse() {
  return Response.json(
    { error: "Teacher PIN required." },
    { status: 401 },
  );
}
