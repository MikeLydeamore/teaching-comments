import { getSession, getTeacherSpace, type Session } from "@/lib/qwt-store";
import { DEFAULT_SPACE_CODE } from "@/lib/qwt-store-model";
import {
  getAuthenticatedTeacherSpaceCode,
  isTeacherAuthenticated,
  isTeacherSpaceCookieValid,
  teacherUnauthorizedResponse,
} from "@/lib/teacher-auth";

export { teacherUnauthorizedResponse };

type AuthorizedTeacherSession =
  | { response: Response; session?: never }
  | { response?: never; session: Session };

export async function isTeacherAuthenticatedForSpaceCode(spaceCode: string) {
  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    return false;
  }

  return isTeacherSpaceCookieValid(space);
}

export async function isTeacherAuthenticatedForSession(session: Session) {
  if (await isTeacherAuthenticatedForSpaceCode(session.spaceCode)) {
    return true;
  }

  return session.spaceCode === DEFAULT_SPACE_CODE && (await isTeacherAuthenticated());
}

export async function getAuthorizedTeacherSession(
  sessionCode: string,
): Promise<AuthorizedTeacherSession> {
  const session = await getSession(sessionCode);

  if (!session) {
    return { response: Response.json({ error: "Session not found." }, { status: 404 }) };
  }

  if (!(await isTeacherAuthenticatedForSession(session))) {
    return { response: await teacherUnauthorizedResponse() };
  }

  return { session };
}

export async function isAnyTeacherAuthenticated() {
  if (await isTeacherAuthenticated()) {
    return true;
  }

  const spaceCode = await getAuthenticatedTeacherSpaceCode();

  if (!spaceCode) {
    return false;
  }

  return isTeacherAuthenticatedForSpaceCode(spaceCode);
}
