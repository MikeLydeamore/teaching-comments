import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { NoAccess } from "@/components/NoAccess";
import { getCurrentTeacher } from "@/lib/auth-server";
import { DEFAULT_SPACE_CODE } from "@/lib/edie-store-model";
import {
  getOrCreateSession,
  getTeacherSpace,
  getSessionStats,
  listSessions,
  listPromptHistory,
  listQuestionBank,
} from "@/lib/edie-store";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";
import { TeacherSpaceDashboard } from "../TeacherSpaceDashboard";
import { TeacherDashboard } from "./TeacherDashboard";

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { sessionCode } = await params;
  const space = await getTeacherSpace(sessionCode);

  if (space) {
    const query = await searchParams;
    const access = await resolveSpaceAccess(space.code);

    if (access.status === "unauthenticated") {
      redirect(loginRedirectPath(`/host/${space.code}`));
    }

    if (access.status !== "ok") {
      return <NoAccess />;
    }

    const teacher = await getCurrentTeacher();
    const sessions = await listSessions(space.code);

    return (
      <>
        {teacher ? <AccountMenu user={teacher} /> : null}
        <TeacherSpaceDashboard
          initialSessionCode={query.session ?? ""}
          sessions={sessions}
          space={space}
        />
      </>
    );
  }

  const access = await resolveSpaceAccess(DEFAULT_SPACE_CODE);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(`/host/${sessionCode}`));
  }

  if (access.status !== "ok") {
    return <NoAccess />;
  }

  const teacher = await getCurrentTeacher();
  const session = await getOrCreateSession(sessionCode);
  const stats = await getSessionStats(session.id);
  const promptHistory = await listPromptHistory(session.id);
  const questionBank = await listQuestionBank(session.id);

  return (
    <>
      {teacher ? <AccountMenu user={teacher} /> : null}
      <TeacherDashboard
        initialPromptHistory={promptHistory}
        initialQuestionBank={questionBank}
        initialStats={stats}
        session={session}
      />
    </>
  );
}
