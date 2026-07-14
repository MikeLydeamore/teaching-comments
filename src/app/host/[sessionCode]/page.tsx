import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import {
  getOrCreateSession,
  getTeacherSpace,
  getSessionStats,
  listSessions,
  listPromptHistory,
  listQuestionBank,
} from "@/lib/qwt-store";
import { TeacherSpaceDashboard } from "../TeacherSpaceDashboard";
import { TeacherDashboard } from "./TeacherDashboard";
import { TeacherLogin } from "./TeacherLogin";

export default async function TeacherPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string; session?: string }>;
}) {
  const { sessionCode } = await params;
  const space = await getTeacherSpace(sessionCode);

  if (space) {
    const query = await searchParams;

    if (!(await isTeacherAuthenticatedForSpaceCode(space.code))) {
      return (
        <TeacherLogin
          authFailed={query.auth === "failed"}
          nextPath={`/host/${space.code}`}
          sessionCode=""
          spaceCode={space.code}
          usesDefaultPin={isDefaultTeacherPin()}
        />
      );
    }

    const sessions = await listSessions(space.code);

    return (
      <TeacherSpaceDashboard
        authFailed={query.auth === "failed"}
        initialSessionCode={query.session ?? ""}
        sessions={sessions}
        space={space}
      />
    );
  }

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
  const promptHistory = await listPromptHistory(session.code);
  const questionBank = await listQuestionBank(session.code);

  return (
    <TeacherDashboard
      initialPromptHistory={promptHistory}
      initialQuestionBank={questionBank}
      initialStats={stats}
      session={session}
    />
  );
}
