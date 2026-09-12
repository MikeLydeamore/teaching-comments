import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import {
  getActivePoll,
  getOrCreateSession,
  getPollResults,
} from "@/lib/edie-store";
import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { getSubmissionViewPayload } from "@/lib/submission-view";
import { TeacherLogin } from "../TeacherLogin";

export default async function TeacherSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { sessionCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${sessionCode}/submissions`;

  if (!(await isTeacherAuthenticated())) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={nextPath}
        sessionCode={sessionCode}
        usesDefaultPin={isDefaultTeacherPin()}
      />
    );
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
