import { QrPopout } from "@/components/QrPopout";
import { getOrCreateSessionInSpace, getTeacherSpace } from "@/lib/qwt-store";
import { isDefaultTeacherPin } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import { TeacherLogin } from "../../TeacherLogin";

export default async function TeacherSpaceQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${spaceCode}/${roomCode}/qr`;
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
        nextPath={`/host/${space.code}/${roomCode}/qr`}
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

  return (
    <QrPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      sessionTitle={session.title}
      studentUrl={`/spaces/${space.code}/${session.code}`}
    />
  );
}
