import { PollResultsPopout } from "@/components/PollResultsPopout";
import {
  getLatestPoll,
  getOrCreateSessionInSpace,
  getPollResults,
  getTeacherSpace,
} from "@/lib/qwt-store";
import { isDefaultTeacherPin } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import { TeacherLogin } from "../../TeacherLogin";

export default async function TeacherSpacePollPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomCode: string; sessionCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${spaceCode}/${roomCode}/poll`;
  const space = await getTeacherSpace(spaceCode);

  if (!space || !(await isTeacherAuthenticatedForSpaceCode(space.code))) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed" || !space}
        nextPath={space ? nextPath : `/host/${spaceCode}`}
        sessionCode={roomCode}
        spaceCode={spaceCode}
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

  const poll = await getLatestPoll(session.code);
  const results = poll ? await getPollResults(poll.id) : null;

  return (
    <PollResultsPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      initialPoll={poll}
      initialResults={results}
      sessionCode={session.code}
      sessionTitle={session.title}
    />
  );
}
