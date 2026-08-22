import { redirect } from "next/navigation";
import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import {
  getOrCreateSession,
  listPromptHistory,
  listSubmissions,
  toSubmissionDto,
} from "@/lib/edie-store";
import { DEFAULT_SPACE_CODE } from "@/lib/edie-store-model";
import { parseSubmissionMinutes } from "@/lib/submission-time-range";
import { NoAccess } from "@/components/NoAccess";
import { loginRedirectPath, resolveSpaceAccess } from "@/lib/teacher-session-auth";

function parseSortOrder(value: string | undefined) {
  return value === "oldest" ? "oldest" : "newest";
}

export default async function TeacherSubmissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{
    auth?: string;
    minutes?: string;
    promptHistoryId?: string;
    sortOrder?: string;
    starredOnly?: string;
  }>;
}) {
  const { sessionCode } = await params;
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

  const nextPath = `/host/${sessionCode}/submissions?${search.toString()}`;

  const access = await resolveSpaceAccess(DEFAULT_SPACE_CODE);

  if (access.status === "unauthenticated") {
    redirect(loginRedirectPath(nextPath));
  }

  if (access.status !== "ok") {
    return <NoAccess />;
  }

  const session = await getOrCreateSession(sessionCode);
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
      dashboardUrl={`/host/${session.code}`}
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
