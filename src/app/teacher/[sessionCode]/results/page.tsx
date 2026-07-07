import Link from "next/link";
import { ResultsChart } from "@/components/ResultsChart";
import { responseCounts } from "@/lib/poll-results";
import { getOrCreateSession, listSubmissions } from "@/lib/qwt-store";
import { isDefaultTeacherPin, isTeacherAuthenticated } from "@/lib/teacher-auth";
import { TeacherLogin } from "../TeacherLogin";

function parseMinutes(value: string | undefined) {
  const minutes = value ? Number(value) : 3;

  if (!Number.isFinite(minutes)) {
    return 3;
  }

  return Math.min(500, Math.max(1, minutes));
}

export default async function TeacherResultsPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionCode: string }>;
  searchParams: Promise<{ auth?: string; includeHidden?: string; minutes?: string }>;
}) {
  const { sessionCode } = await params;
  const query = await searchParams;
  const minutes = parseMinutes(query.minutes);
  const includeHidden = query.includeHidden === "true";
  const search = new URLSearchParams({
    includeHidden: String(includeHidden),
    minutes: String(minutes),
  });
  const nextPath = `/teacher/${sessionCode}/results?${search.toString()}`;

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
  const submissions = await listSubmissions(session.code, {
    includeHidden,
    minutes,
  });
  const results = responseCounts(submissions);
  const total = results.reduce((sum, [, count]) => sum + count, 0);
  const maxCount = Math.max(1, ...results.map(([, count]) => count));

  return (
    <main className="min-h-screen bg-white px-8 py-7 text-slate-950">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-200 pb-5">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Quick Write results
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-normal">
            {session.title}
          </h1>
          <p className="mt-2 text-base text-slate-600">
            Last {minutes} minute{minutes === 1 ? "" : "s"}
            {includeHidden ? ", including hidden responses" : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <p className="rounded-md border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700">
            {total} typed
          </p>
          <Link
            className="rounded-md border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            href={`/teacher/${session.code}`}
          >
            Dashboard
          </Link>
        </div>
      </header>

      <ResultsChart
        maxCount={maxCount}
        results={results}
        total={total}
        variant="screen"
      />
    </main>
  );
}
