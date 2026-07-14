import Link from "next/link";
import { ResponseTimePlot } from "@/components/ResponseTimePlot";
import { ResultsChart, type ChartType } from "@/components/ResultsChart";
import { responseCounts, responseWordCounts } from "@/lib/poll-results";
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

function parseChartType(value: string | undefined): ChartType {
  if (value === "pie" || value === "wordCloud") {
    return value;
  }

  return "column";
}

const chartTypeOptions: { label: string; value: ChartType }[] = [
  { label: "Column", value: "column" },
  { label: "Pie", value: "pie" },
  { label: "Word cloud", value: "wordCloud" },
];

export default async function TeacherResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{
    auth?: string;
    chartType?: string;
    includeHidden?: string;
    minutes?: string;
    promptHistoryId?: string;
    starredOnly?: string;
  }>;
}) {
  const { sessionCode } = await params;
  const query = await searchParams;
  const minutes = parseMinutes(query.minutes);
  const chartType = parseChartType(query.chartType);
  const includeHidden = query.includeHidden === "true";
  const promptHistoryId = query.promptHistoryId ?? "";
  const starredOnly = query.starredOnly === "true";
  const search = new URLSearchParams({
    chartType,
    includeHidden: String(includeHidden),
    minutes: String(minutes),
    starredOnly: String(starredOnly),
  });

  if (promptHistoryId) {
    search.set("promptHistoryId", promptHistoryId);
  }

  const nextPath = `/host/${sessionCode}/results?${search.toString()}`;

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
  const results =
    chartType === "wordCloud"
      ? responseWordCounts(displayedSubmissions)
      : responseCounts(displayedSubmissions);
  const total = results.reduce((sum, [, count]) => sum + count, 0);
  const maxCount = Math.max(1, ...results.map(([, count]) => count));

  return (
    <main className="min-h-screen bg-white px-8 py-7 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie results
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-normal">
            {session.title}
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Last {minutes} minute{minutes === 1 ? "" : "s"}
            {includeHidden ? ", including hidden responses" : ""}
            {starredOnly ? ", starred responses only" : ""}
            {selectedPromptHistory ? ", filtered by prompt" : ""}
          </p>
          {selectedPromptHistory ? (
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              {selectedPromptHistory.prompt}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-md border border-slate-300 bg-slate-50 p-1">
            {chartTypeOptions.map((option) => {
              const typeSearch = new URLSearchParams(search);
              typeSearch.set("chartType", option.value);

              return (
                <Link
                  className={`rounded px-4 py-2 text-base font-semibold transition ${
                    chartType === option.value
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-teal-800"
                  }`}
                  href={`/host/${session.code}/results?${typeSearch.toString()}`}
                  key={option.value}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
          <p className="rounded-md border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700">
            {total} {chartType === "wordCloud" ? "words" : "typed"}
          </p>
          <Link
            className="rounded-md border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            href={`/host/${session.code}`}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <ResultsChart
        chartType={chartType}
        maxCount={maxCount}
        results={results}
        total={total}
        variant="screen"
      />
      <ResponseTimePlot
        promptUpdatedAt={selectedPromptHistory?.startedAt ?? session.promptUpdatedAt}
        submissions={displayedSubmissions}
        variant="screen"
      />
    </main>
  );
}
