import { redirect } from "next/navigation";
import { QrPopout } from "@/components/QrPopout";
import { getOrCreateSessionInSpace, getTeacherSpace } from "@/lib/edie-store";
import { NoAccess } from "@/components/NoAccess";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherSpaceQrPage({
  params,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const nextPath = `/host/${spaceCode}/${roomCode}/qr`;
  const space = await getTeacherSpace(spaceCode);
  const access = await resolveSpaceAccess(spaceCode);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(nextPath));
  }

  if (access.status !== "ok" || !space) {
    return <NoAccess />;
  }

  const session = await getOrCreateSessionInSpace(space.code, roomCode);

  if (!session) {
    redirect(`/host/${space.code}`);
  }

  return (
    <QrPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      sessionTitle={session.title}
      studentUrl={`/spaces/${space.code}/${session.code}`}
    />
  );
}
