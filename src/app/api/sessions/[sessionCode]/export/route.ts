import {
  listGroupQuestions,
  listSubmissions,
} from "@/lib/qwt-store";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

const columns = [
  "record_type",
  "session_code",
  "session_title",
  "current_prompt",
  "current_prompt_updated_at",
  "id",
  "student_name",
  "text",
  "created_at",
  "updated_at",
  "archived_at",
  "status",
  "starred",
  "flagged",
  "version",
  "has_drawing",
  "drawing_data_json",
  "has_gif",
  "gif_title",
  "gif_preview_url",
  "gif_url",
  "is_answered",
  "is_visible",
  "vote_count",
];

function csvCell(value: unknown) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  const text = String(value);

  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function csvRow(values: unknown[]) {
  return values.map(csvCell).join(",");
}

function filenameFromSessionCode(sessionCode: string) {
  return `edie-${sessionCode}-${new Date().toISOString().slice(0, 10)}.csv`;
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/export">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const { session } = authorization;

  const [submissions, groupQuestions] = await Promise.all([
    listSubmissions(session.code, { includeArchived: true, includeHidden: true }),
    listGroupQuestions(session.code, undefined, {
      includeAnswered: true,
      includeArchived: true,
      includeHidden: true,
    }),
  ]);

  const rows = [
    csvRow(columns),
    ...submissions.map((submission) =>
      csvRow([
        "submission",
        session.code,
        session.title,
        session.prompt,
        session.promptUpdatedAt,
        submission.id,
        submission.studentName,
        submission.text,
        submission.createdAt,
        submission.updatedAt,
        submission.archivedAt,
        submission.status,
        submission.starred,
        submission.flagged,
        submission.version,
        Boolean(submission.drawingData),
        submission.drawingData ? JSON.stringify(submission.drawingData) : "",
        Boolean(submission.gifData),
        submission.gifData?.title ?? "",
        submission.gifData?.previewUrl ?? "",
        submission.gifData?.giphyUrl ?? submission.gifData?.url ?? "",
        "",
        "",
        "",
      ]),
    ),
    ...groupQuestions.map((question) =>
      csvRow([
        "group_question",
        session.code,
        session.title,
        session.prompt,
        session.promptUpdatedAt,
        question.id,
        question.studentName,
        question.text,
        question.createdAt,
        question.updatedAt,
        question.archivedAt,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        question.isAnswered,
        question.isVisible,
        question.voteCount,
      ]),
    ),
  ];

  return new Response(`${rows.join("\r\n")}\r\n`, {
    headers: {
      "Content-Disposition": `attachment; filename="${filenameFromSessionCode(session.code)}"`,
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}
