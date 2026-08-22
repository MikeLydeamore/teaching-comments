import { getSession, getTeacherSpace, type Session } from "@/lib/edie-store";
import { getCurrentTeacher, getSpaceRoleForUser } from "@/lib/auth-server";

export function teacherUnauthorizedResponse() {
  return Response.json(
    { error: "Teacher sign-in required." },
    { status: 401 },
  );
}

type AuthorizedTeacherSession =
  | { response: Response; session?: never }
  | { response?: never; session: Session };

export type SpaceAccess =
  | { status: "ok"; role: "owner" | "editor" }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

/**
 * Page-level gate for host surfaces: resolves the signed-in user's role in a
 * space. Callers redirect on "unauthenticated" and render a no-access view on
 * "forbidden".
 */
export async function resolveSpaceAccess(
  spaceCode: string,
): Promise<SpaceAccess> {
  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    return { status: "forbidden" };
  }

  const role = await getSpaceRoleForUser(space.code);

  if (role) {
    return { status: "ok", role };
  }

  const teacher = await getCurrentTeacher();
  return teacher ? { status: "forbidden" } : { status: "unauthenticated" };
}

export function loginRedirectPath(returnTo: string) {
  return `/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export async function isTeacherAuthenticatedForSpaceCode(spaceCode: string) {
  return (await getSpaceRoleForUser(spaceCode)) !== null;
}

export async function getAuthorizedTeacherSession(
  sessionCode: string,
): Promise<AuthorizedTeacherSession> {
  const session = await getSession(sessionCode);

  if (!session) {
    return { response: Response.json({ error: "Session not found." }, { status: 404 }) };
  }

  if (!(await isTeacherAuthenticatedForSpaceCode(session.spaceCode))) {
    return { response: await teacherUnauthorizedResponse() };
  }

  return { session };
}
