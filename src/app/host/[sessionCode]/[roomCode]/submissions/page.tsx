import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import {
  getOrCreateSessionInSpace,
  getTeacherSpace,
  listPromptHistory,
  listSubmissions,
  toSubmissionDto,
} from "@/lib/edie-store";
import { isDefaultTeacherPin } from "@/lib/teacher-auth";
import { isTeacherAuthenticatedForSpaceCode } from "@/lib/teacher-session-auth";
import { parseSubmissionMinutes } from "@/lib/submission-time-range";
import { TeacherLogin } from "../../TeacherLogin";

function parseSortOrder(value: string | undefined) {
  return value === "oldest" ? "oldest" : "newest";
}

export default async function TeacherSpaceSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string; roomCode: string }>;
  searchParams: Promise<{
    auth?: string;
    minutes?: string;
    promptHistoryId?: string;
    sortOrder?: string;
    starredOnly?: string;
  }>;
}) {
  const { roomCode, sessionCode: spaceCode } = await params;
  const query = await searchParams;
  const minutes = parseSubmissionMinutes(query.minutes);
  const includeHidden = false;
  const promptHistoryId = query.promptHistoryId ?? "";
  const sortOrder = parseSortOrder(query.sortOrder);
  const starredOnly = query.starredOnly === "true";
  const search = new URLSearchParams({
    includeHidden: String(includeHidden),
    minutes: String(minutes),
    sortOrder,
    starredOnly: String(starredOnly),
  });

  if (promptHistoryId) {
    search.set("promptHistoryId", promptHistoryId);
  }

  const nextPath = `/host/${spaceCode}/${roomCode}/submissions?${search.toString()}`;
  const space = await getTeacherSpace(spaceCode);

  if (!space) {
    return (
      <TeacherLogin
        authFailed={query.auth === "failed"}
        nextPath={nextPath}
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
        nextPath={`/host/${space.code}/${roomCode}/submissions?${search.toString()}`}
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

  const promptHistory = await listPromptHistory(session.id);
  const selectedPromptHistory = promptHistory.find(
    (item) => item.id === promptHistoryId,
  );
  const submissions = await listSubmissions(session.id, {
    includeHidden,
    minutes,
    promptHistoryId: selectedPromptHistory?.id,
  });
  const displayedSubmissions = starredOnly
    ? submissions.filter((submission) => submission.starred)
    : submissions;

  return (
    <SubmissionsPopout
      dashboardUrl={`/host/${space.code}/${session.code}`}
      includeHidden={includeHidden}
      initialSubmissions={displayedSubmissions.map(toSubmissionDto)}
      minutes={minutes}
      promptHistoryId={selectedPromptHistory?.id}
      promptOptions={promptHistory.map(({ id, prompt }) => ({ id, prompt }))}
      promptText={selectedPromptHistory?.prompt ?? session.prompt}
      sessionCode={session.id}
      sessionTitle={session.title}
      sortOrder={sortOrder}
      starredOnly={starredOnly}
    />
  );
}
