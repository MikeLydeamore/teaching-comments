"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import type { Submission } from "@/lib/qwt-store";

type SubmissionsPopoutProps = {
  dashboardUrl: string;
  includeHidden: boolean;
  initialSubmissions: Submission[];
  minutes: number;
  promptHistoryId?: string;
  promptText?: string;
  sessionCode: string;
  sessionTitle: string;
  sortOrder: "newest" | "oldest";
  starredOnly: boolean;
};

function sortSubmissions(
  submissions: Submission[],
  sortOrder: "newest" | "oldest",
) {
  return [...submissions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}

function responseTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SubmissionsPopout({
  dashboardUrl,
  includeHidden,
  initialSubmissions,
  minutes,
  promptHistoryId,
  promptText,
  sessionCode,
  sessionTitle,
  sortOrder,
  starredOnly,
}: SubmissionsPopoutProps) {
  const [submissions, setSubmissions] = useState(() =>
    sortSubmissions(initialSubmissions, sortOrder),
  );
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const queryString = useMemo(() => {
    const query = new URLSearchParams({
      includeHidden: String(includeHidden),
      minutes: String(minutes),
    });

    if (promptHistoryId) {
      query.set("promptHistoryId", promptHistoryId);
    }

    return query.toString();
  }, [includeHidden, minutes, promptHistoryId]);

  const refresh = useCallback(async () => {
    const response = await fetch(
      `/api/sessions/${sessionCode}/submissions?${queryString}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      submissions?: Submission[];
    };
    const nextSubmissions = payload.submissions ?? [];
    const nextVisibleSubmissions = starredOnly
      ? nextSubmissions.filter((submission) => submission.starred)
      : nextSubmissions;

    setSubmissions(sortSubmissions(nextVisibleSubmissions, sortOrder));
    setLastRefresh(new Date());
  }, [queryString, sessionCode, sortOrder, starredOnly]);

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-950">
      <header className="rounded-md border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
              Ed.ie submissions
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-normal">
              {sessionTitle}
            </h1>
            <p className="mt-2 text-base text-slate-600">
              Last {minutes} minute{minutes === 1 ? "" : "s"}
              {includeHidden ? ", including hidden responses" : ""}
              {starredOnly ? ", starred responses only" : ""}
              {promptText ? ", filtered by prompt" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="rounded-md border border-slate-200 px-4 py-3 text-base font-semibold text-slate-700">
              {submissions.length} shown
            </p>
            <Link
              className="rounded-md border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
              href={dashboardUrl}
            >
              Dashboard
            </Link>
          </div>
        </div>
        {promptText ? (
          <p className="mt-4 max-w-5xl rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-base leading-7 text-slate-700">
            {promptText}
          </p>
        ) : null}
        <p className="mt-3 text-sm text-slate-500">
          {lastRefresh
            ? `Updated ${lastRefresh.toLocaleTimeString()}`
            : "Loading latest submissions..."}
        </p>
      </header>

      {submissions.length ? (
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {submissions.map((submission) => (
            <article
              className={`rounded-md border bg-white p-5 shadow-sm ${
                submission.status === "hidden"
                  ? "border-slate-200 opacity-60"
                  : "border-slate-300"
              }`}
              key={submission.id}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {submission.studentName || "Anonymous"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {responseTime(submission.createdAt)}
                  </p>
                </div>
                {submission.status === "hidden" ? (
                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Hidden
                  </span>
                ) : null}
              </div>

              {submission.text ? (
                <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-4 text-xl leading-8 text-slate-950">
                  {submission.text}
                </p>
              ) : !submission.drawingData && !submission.gifData ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 p-4 text-base font-medium text-slate-600">
                  Media-only response
                </p>
              ) : null}

              {submission.gifData ? (
                <GifPreview gifData={submission.gifData} />
              ) : null}
              {submission.drawingData ? (
                <DrawingPreview drawingData={submission.drawingData} />
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-white p-12 text-center text-lg font-medium text-slate-500">
          No submissions in this view yet.
        </div>
      )}
    </main>
  );
}
