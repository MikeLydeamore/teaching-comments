import { redirect } from "next/navigation";
import { PollResultsPopout } from "@/components/PollResultsPopout";
import {
  getLatestPoll,
  getOrCreateSession,
  getPollResults,
} from "@/lib/edie-store";
import { DEFAULT_SPACE_CODE } from "@/lib/edie-store-model";
import { NoAccess } from "@/components/NoAccess";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherPollPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;
  const nextPath = `/host/${sessionCode}/poll`;

  const access = await resolveSpaceAccess(DEFAULT_SPACE_CODE);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(nextPath));
  }

  if (access.status !== "ok") {
    return <NoAccess />;
  }

  const session = await getOrCreateSession(sessionCode);
  const poll = await getLatestPoll(session.id);
  const results = poll ? await getPollResults(poll.id) : null;

  return (
    <PollResultsPopout
      dashboardUrl={`/host/${session.code}`}
      initialPoll={poll}
      initialResults={results}
      sessionCode={session.id}
      sessionTitle={session.title}
    />
  );
}
