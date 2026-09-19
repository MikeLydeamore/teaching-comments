import { redirect } from "next/navigation";
import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import { NoAccess } from "@/components/NoAccess";
import {
  getActivePoll,
  getOrCreateSessionInSpace,
  getPollResults,
  getTeacherSpace,
} from "@/lib/edie-store";
import { getSubmissionViewPayload } from "@/lib/submission-view";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherSpaceSubmissionsPage({
  params,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const nextPath = `/host/${spaceCode}/${roomCode}/submissions`;
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

  const [initialView, initialPoll] = await Promise.all([
    getSubmissionViewPayload(session, false),
    getActivePoll(session.id),
  ]);
  const initialPollResults = initialPoll
    ? await getPollResults(initialPoll.id)
    : null;

  return (
    <SubmissionsPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      initialPoll={initialPoll}
      initialPollResults={initialPollResults}
      initialView={initialView}
      sessionCode={session.id}
      sessionTitle={session.title}
      studentUrl={`/spaces/${space.code}/${session.code}`}
    />
  );
}
