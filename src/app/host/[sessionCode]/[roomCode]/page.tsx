import { isDefaultTeacherPin } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import {
  getOrCreateSessionInSpace,
  getSessionStats,
  getTeacherSpace,
  listPromptHistory,
  listQuestionBank,
} from "@/lib/qwt-store";
import { TeacherDashboard } from "../TeacherDashboard";
import { TeacherLogin } from "../TeacherLogin";

export default async function TeacherSpaceSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const query = await searchParams;
  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={`/host/${spaceCode}/${roomCode}`}
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
        nextPath={`/host/${space.code}/${roomCode}`}
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

  const stats = await getSessionStats(session.code);
  const promptHistory = await listPromptHistory(session.code);
  const questionBank = await listQuestionBank(session.code);

  return (
    <TeacherDashboard
      initialPromptHistory={promptHistory}
      initialQuestionBank={questionBank}
      initialStats={stats}
      session={session}
      spaceCode={space.code}
    />
  );
}
