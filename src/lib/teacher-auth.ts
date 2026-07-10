import {
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import type { TeacherSpace } from "@/lib/qwt-store";

export const TEACHER_COOKIE = "qwt_teacher";
export const TEACHER_SPACE_COOKIE = "qwt_teacher_space";

const COOKIE_MAX_AGE_SECONDS = 8 * 60 * 60;
const DEFAULT_DEV_PIN = "teach123";
const PIN_HASH_KEY_LENGTH = 32;

function teacherPin() {
  return process.env.TEACHER_PIN?.trim() || DEFAULT_DEV_PIN;
}

function adminPin() {
  return process.env.ADMIN_PIN?.trim() || teacherPin();
}

function authSecret() {
  return (
    process.env.TEACHER_AUTH_SECRET?.trim() ||
    process.env.ADMIN_PIN?.trim() ||
    teacherPin()
  );
}

export function isDefaultTeacherPin() {
  return teacherPin() === DEFAULT_DEV_PIN;
}

export function isDefaultAdminPin() {
  return adminPin() === DEFAULT_DEV_PIN;
}

export function isValidTeacherPin(pin: string) {
  return pin.trim() === teacherPin();
}

export function isValidAdminPin(pin: string) {
  return pin.trim() === adminPin();
}

function teacherToken() {
  return createHash("sha256")
    .update(`quick-write-teacher:${teacherPin()}`)
    .digest("hex");
}

function teacherSpaceToken(space: TeacherSpace) {
  return createHash("sha256")
    .update(`quick-write-space:${space.code}:${space.pinHash}:${authSecret()}`)
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

function safeEqualHex(left: string, right: string) {
  return /^[a-f0-9]+$/i.test(left) && safeEqual(left, right);
}

export function hashTeacherSpacePin(pin: string) {
  const normalizedPin = pin.trim();

  if (normalizedPin.length < 4 || normalizedPin.length > 120) {
    throw new Error("Space PIN must be between 4 and 120 characters.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(normalizedPin, salt, PIN_HASH_KEY_LENGTH).toString("hex");

  return `scrypt:${salt}:${hash}`;
}

export function isValidTeacherSpacePin(pin: string, pinHash: string) {
  const normalizedPin = pin.trim();

  if (pinHash.startsWith("plain:")) {
    return safeEqual(normalizedPin, pinHash.slice("plain:".length));
  }

  const [scheme, salt, expectedHash] = pinHash.split(":");

  if (scheme !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const hash = scryptSync(normalizedPin, salt, PIN_HASH_KEY_LENGTH).toString("hex");
  return safeEqualHex(hash, expectedHash);
}

export async function isTeacherAuthenticated() {
  const cookieStore = await cookies();
  const value = cookieStore.get(TEACHER_COOKIE)?.value;

  return Boolean(value && safeEqual(value, teacherToken()));
}

export async function getAuthenticatedTeacherSpaceCode() {
  const cookieStore = await cookies();
  const value = cookieStore.get(TEACHER_SPACE_COOKIE)?.value ?? "";
  const [spaceCode] = value.split(".", 1);

  return spaceCode || "";
}

export async function isTeacherSpaceCookieValid(space: TeacherSpace) {
  const cookieStore = await cookies();
  const value = cookieStore.get(TEACHER_SPACE_COOKIE)?.value ?? "";
  const separatorIndex = value.indexOf(".");

  if (separatorIndex === -1) {
    return false;
  }

  const cookieSpaceCode = value.slice(0, separatorIndex);
  const cookieToken = value.slice(separatorIndex + 1);

  return (
    cookieSpaceCode === space.code &&
    Boolean(cookieToken) &&
    safeEqual(cookieToken, teacherSpaceToken(space))
  );
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

export async function setTeacherSpaceAuthCookie(space: TeacherSpace) {
  const cookieStore = await cookies();

  cookieStore.set(
    TEACHER_SPACE_COOKIE,
    `${space.code}.${teacherSpaceToken(space)}`,
    {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
}

export async function clearTeacherAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(TEACHER_COOKIE);
  cookieStore.delete(TEACHER_SPACE_COOKIE);
}

export async function teacherUnauthorizedResponse() {
  return Response.json(
    { error: "Teacher PIN required." },
    { status: 401 },
  );
}
