import { SubmissionsPopout } from "@/components/SubmissionsPopout";
import {
  getOrCreateSession,
  listPromptHistory,
  listSubmissions,
} from "@/lib/qwt-store";
import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { TeacherLogin } from "../TeacherLogin";

function parseMinutes(value: string | undefined) {
  const minutes = value ? Number(value) : 3;

  if (!Number.isFinite(minutes)) {
    return 3;
  }

  return Math.min(500, Math.max(1, minutes));
}

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
  const minutes = parseMinutes(query.minutes);
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
  const promptHistory = await listPromptHistory(session.code);
  const selectedPromptHistory = promptHistory.find(
    (item) => item.id === promptHistoryId,
  );
  const submissions = await listSubmissions(session.code, {
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
      initialSubmissions={displayedSubmissions}
      minutes={minutes}
      promptHistoryId={selectedPromptHistory?.id}
      promptText={selectedPromptHistory?.prompt}
      sessionCode={session.code}
      sessionTitle={session.title}
      sortOrder={sortOrder}
      starredOnly={starredOnly}
    />
  );
}
