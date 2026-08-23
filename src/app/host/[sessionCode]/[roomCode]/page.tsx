import { redirect } from "next/navigation";
import { AccountMenu } from "@/components/AccountMenu";
import { NoAccess } from "@/components/NoAccess";
import { getCurrentTeacher } from "@/lib/auth-server";
import {
  getOrCreateSessionInSpace,
  getSessionStats,
  getTeacherSpace,
  listPromptHistory,
  listQuestionBank,
} from "@/lib/edie-store";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";
import { TeacherDashboard } from "../TeacherDashboard";

export default async function TeacherSpaceSessionPage({
  params,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const space = await getTeacherSpace(spaceCode);
  const access = await resolveSpaceAccess(spaceCode);

  if (access.status === "unauthenticated") {
    redirect(
      loginRedirectPath(`/host/${space?.code ?? spaceCode}/${roomCode}`),
    );
  }

  if (access.status !== "ok" || !space) {
    return <NoAccess />;
  }

  const session = await getOrCreateSessionInSpace(space.code, roomCode);

  if (!session) {
    redirect(`/host/${space.code}`);
  }

  const teacher = await getCurrentTeacher();
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
        spaceCode={space.code}
        spaceName={space.name}
      />
    </>
  );
}
