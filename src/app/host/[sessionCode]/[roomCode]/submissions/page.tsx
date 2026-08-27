import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import { getOrCreateSessionInSpace, getTeacherSpace } from "@/lib/edie-store";
import { isDefaultTeacherPin } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import { getSubmissionViewPayload } from "@/lib/submission-view";
import { TeacherLogin } from "../../TeacherLogin";

export default async function TeacherSpaceSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${spaceCode}/${roomCode}/submissions`;
  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={nextPath}
        sessionCode={roomCode}
        spaceCode={spaceCode}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
  }

  if (!(await isTeacherAuthenticatedForSpaceCode(space.code))) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={`/host/${space.code}/${roomCode}/submissions`}
        sessionCode={roomCode}
        spaceCode={space.code}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
  }

  const session = await getOrCreateSessionInSpace(space.code, roomCode);

  if (!session) {
    return (
      <TeacherLogin
        authFailed
        nextPath={`/host/${space.code}`}
        sessionCode={roomCode}
        spaceCode={space.code}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
  }

  const initialView = await getSubmissionViewPayload(session, false);

  return (
    <SubmissionsPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      initialView={initialView}
      sessionCode={session.id}
      sessionTitle={session.title}
    />
  );
}
