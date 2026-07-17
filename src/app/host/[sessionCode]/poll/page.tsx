import { PollResultsPopout } from "@/components/PollResultsPopout";
import {
  getLatestPoll,
  getOrCreateSession,
  getPollResults,
} from "@/lib/qwt-store";
import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { TeacherLogin } from "../TeacherLogin";

export default async function TeacherPollPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string }>;
}) {
  const { sessionCode } = await params;
  const query = await searchParams;
  const nextPath = `/host/${sessionCode}/poll`;

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
  const poll = await getLatestPoll(session.code);
  const results = poll ? await getPollResults(poll.id) : null;

  return (
    <PollResultsPopout
      dashboardUrl={`/host/${session.code}`}
      initialPoll={poll}
      initialResults={results}
      sessionCode={session.code}
      sessionTitle={session.title}
    />
  );
}
