import "server-only";

import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getSpaceMemberRole } from "@/lib/edie-store";
import type { SpaceRole } from "@/lib/edie-store-model";

type CurrentTeacher = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
};

function adminAllowList() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function getCurrentTeacher(): Promise<CurrentTeacher | null> {
  const session = await getAuth().api.getSession({ headers: await headers() });

  if (!session?.user || !session.user.email) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    emailVerified: session.user.emailVerified ?? false,
    image: session.user.image ?? null,
  };
}

/** Only allow-listed emails with a provider-verified address may administer. */
export function isAdminTeacher(teacher: CurrentTeacher) {
  return (
    teacher.emailVerified &&
    Boolean(teacher.email) &&
    adminAllowList().includes(teacher.email.toLowerCase())
  );
}

export async function isAdminAuthenticated() {
  const teacher = await getCurrentTeacher();
  return teacher !== null && isAdminTeacher(teacher);
}

export async function isAdminEmailConfigured() {
  return adminAllowList().length > 0;
}

export async function getSpaceRoleForUser(
  spaceCode: string,
): Promise<SpaceRole | null> {
  const teacher = await getCurrentTeacher();

  if (!teacher) {
    return null;
  }

  return getSpaceMemberRole(spaceCode, teacher.email);
}
