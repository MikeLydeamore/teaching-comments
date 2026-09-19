import { redirect } from "next/navigation";
import { PollResultsPopout } from "@/components/PollResultsPopout";
import {
  getLatestPoll,
  getOrCreateSessionInSpace,
  getPollResults,
  getTeacherSpace,
} from "@/lib/edie-store";
import { NoAccess } from "@/components/NoAccess";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherSpacePollPage({
  params,
}: {
  params: Promise<{ roomCode: string; sessionCode: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const nextPath = `/host/${spaceCode}/${roomCode}/poll`;
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

  const poll = await getLatestPoll(session.id);
  const results = poll ? await getPollResults(poll.id) : null;

  return (
    <PollResultsPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      initialPoll={poll}
      initialResults={results}
      sessionCode={session.id}
      sessionTitle={session.title}
    />
  );
}
