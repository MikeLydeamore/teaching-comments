import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { getOrCreateSession, getSessionStats } from "@/lib/qwt-store";
import { TeacherDashboard } from "./TeacherDashboard";
import { TeacherLogin } from "./TeacherLogin";

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { sessionCode } = await params;

  if (!(await isTeacherAuthenticated())) {
    const query = await searchParams;

    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        sessionCode={sessionCode}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
  }

  const session = await getOrCreateSession(sessionCode);
  const stats = await getSessionStats(session.code);

  return <TeacherDashboard initialStats={stats} session={session} />;
}
