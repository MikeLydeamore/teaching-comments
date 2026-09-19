import { redirect } from "next/navigation";
import { QrPopout } from "@/components/QrPopout";
import { getOrCreateSession } from "@/lib/edie-store";
import { DEFAULT_SPACE_CODE } from "@/lib/edie-store-model";
import { NoAccess } from "@/components/NoAccess";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherQrPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;
  const nextPath = `/host/${sessionCode}/qr`;

  const access = await resolveSpaceAccess(DEFAULT_SPACE_CODE);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(nextPath));
  }

  if (access.status !== "ok") {
    return <NoAccess />;
  }

  const session = await getOrCreateSession(sessionCode);

  return (
    <QrPopout
      dashboardUrl={`/host/${session.code}`}
      sessionTitle={session.title}
      studentUrl={`/spaces/${session.code}`}
    />
  );
}
