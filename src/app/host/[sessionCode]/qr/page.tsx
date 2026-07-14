import { QrPopout } from "@/components/QrPopout";
import { getOrCreateSession } from "@/lib/qwt-store";
import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { TeacherLogin } from "../TeacherLogin";

export default async function TeacherQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { sessionCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${sessionCode}/qr`;

  if (!(await isTeacherAuthenticated())) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={nextPath}
        sessionCode={sessionCode}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
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
