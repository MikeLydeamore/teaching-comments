import { redirect } from "next/navigation";
import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import { NoAccess } from "@/components/NoAccess";
import {
  getActivePoll,
  getOrCreateSession,
  getPollResults,
} from "@/lib/edie-store";
import { DEFAULT_SPACE_CODE } from "@/lib/edie-store-model";
import { getSubmissionViewPayload } from "@/lib/submission-view";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

export default async function TeacherSubmissionsPage({
  params,
}: {
  params: Promise<{ sessionCode: string }>;
}) {
  const { sessionCode } = await params;
  const nextPath = `/host/${sessionCode}/submissions`;

  const access = await resolveSpaceAccess(DEFAULT_SPACE_CODE);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(nextPath));
  }

  if (access.status !== "ok") {
    return <NoAccess />;
  }

  const session = await getOrCreateSession(sessionCode);
  const [initialView, initialPoll] = await Promise.all([
    getSubmissionViewPayload(session, false),
    getActivePoll(session.id),
  ]);
  const initialPollResults = initialPoll
    ? await getPollResults(initialPoll.id)
    : null;

  return (
    <SubmissionsPopout
      dashboardUrl={`/host/${session.code}`}
      initialPoll={initialPoll}
      initialPollResults={initialPollResults}
      initialView={initialView}
      sessionCode={session.id}
      sessionTitle={session.title}
      studentUrl={`/spaces/${session.code}`}
    />
  );
}
