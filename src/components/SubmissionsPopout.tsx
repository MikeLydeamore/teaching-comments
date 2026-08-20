"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import { InlineCodeText } from "@/components/InlineCodeText";
import { SubmissionImagePreview } from "@/components/SubmissionImagePreview";
import type { SubmissionDto } from "@/lib/qwt-store";
import { submissionTimeRangeLabel } from "@/lib/submission-time-range";

type SubmissionsPopoutProps = {
  dashboardUrl: string;
  includeHidden: boolean;
  initialSubmissions: SubmissionDto[];
  minutes: number;
  promptHistoryId?: string;
  promptOptions: Array<{ id: string; prompt: string }>;
  promptText?: string;
  sessionCode: string;
  sessionTitle: string;
  sortOrder: "newest" | "oldest";
  starredOnly: boolean;
};

function subscribeToHydration() {
  return () => {};
}

function useHasHydrated() {
  return useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
}

function sortSubmissions(
  submissions: SubmissionDto[],
  sortOrder: "newest" | "oldest",
) {
  return [...submissions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();

    return sortOrder === "oldest" ? leftTime - rightTime : rightTime - leftTime;
  });
}

function submissionsAreUnchanged(
  currentSubmissions: SubmissionDto[],
  nextSubmissions: SubmissionDto[],
) {
  return (
    currentSubmissions.length === nextSubmissions.length &&
    currentSubmissions.every((submission, index) => {
      const nextSubmission = nextSubmissions[index];
      return (
        submission.id === nextSubmission?.id &&
        submission.version === nextSubmission.version
      );
    })
  );
}

function responseTime(value: string, hasHydrated: boolean) {
  if (!hasHydrated) {
    return "Submitted";
  }

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
  promptOptions,
  promptText,
  sessionCode,
  sessionTitle,
  sortOrder,
  starredOnly,
}: SubmissionsPopoutProps) {
  const [submissions, setSubmissions] = useState(() =>
    sortSubmissions(initialSubmissions, sortOrder),
  );
  const hasHydrated = useHasHydrated();
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

  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(
      `/api/sessions/${sessionCode}/submissions?${queryString}`,
      { cache: "no-store", signal },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      submissions?: SubmissionDto[];
    };
    const nextSubmissions = payload.submissions ?? [];
    const nextVisibleSubmissions = starredOnly
      ? nextSubmissions.filter((submission) => submission.starred)
      : nextSubmissions;
    const sortedSubmissions = sortSubmissions(
      nextVisibleSubmissions,
      sortOrder,
    );

    setSubmissions((currentSubmissions) =>
      submissionsAreUnchanged(currentSubmissions, sortedSubmissions)
        ? currentSubmissions
        : sortedSubmissions,
    );
    setLastRefresh(new Date());
  }, [queryString, sessionCode, sortOrder, starredOnly]);

  useEffect(() => {
    const controller = new AbortController();
    let timer: number | null = null;
    let disposed = false;

    const poll = async () => {
      try {
        await refresh(controller.signal);
      } catch {
        // A later poll can recover from transient network failures.
      } finally {
        if (!disposed) {
          timer = window.setTimeout(() => {
            void poll();
          }, 3000);
        }
      }
    };

    timer = window.setTimeout(() => {
      void poll();
    }, 3000);

    return () => {
      disposed = true;
      controller.abort();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [refresh]);

  function selectPrompt(nextPromptHistoryId: string) {
    const url = new URL(window.location.href);

    if (nextPromptHistoryId) {
      url.searchParams.set("promptHistoryId", nextPromptHistoryId);
    } else {
      url.searchParams.delete("promptHistoryId");
    }

    window.location.assign(url.toString());
  }

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
          <div className="relative mt-4 w-full rounded-md border border-slate-200 bg-slate-50 p-4">
            <span className="inline-flex rounded-full bg-teal-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-teal-900">
              Prompt
            </span>
            <details className="group absolute right-4 top-4">
              <summary
                aria-label="Choose prompt"
                className="flex size-8 cursor-pointer list-none items-center justify-center rounded-md border border-slate-300 bg-white text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100 [&::-webkit-details-marker]:hidden"
              >
                <span aria-hidden="true" className="transition group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute right-0 z-10 mt-2 max-h-64 w-80 overflow-y-auto rounded-md border border-slate-200 bg-white p-1 shadow-lg">
                <button
                  className={`w-full rounded px-3 py-2 text-left text-sm font-medium transition hover:bg-teal-50 ${
                    !promptHistoryId ? "bg-teal-50 text-teal-900" : "text-slate-700"
                  }`}
                  onClick={() => selectPrompt("")}
                  type="button"
                >
                  All prompts
                </button>
                {promptOptions.map((prompt) => (
                  <button
                    className={`mt-1 w-full rounded px-3 py-2 text-left text-sm leading-5 transition hover:bg-teal-50 ${
                      promptHistoryId === prompt.id
                        ? "bg-teal-50 font-medium text-teal-900"
                        : "text-slate-700"
                    }`}
                    key={prompt.id}
                    onClick={() => selectPrompt(prompt.id)}
                    type="button"
                  >
                    {prompt.prompt}
                  </button>
                ))}
              </div>
            </details>
            <p className="mt-3 max-h-40 overflow-y-auto break-words pr-2 text-xl font-medium leading-8 text-slate-900">
              <InlineCodeText>{promptText}</InlineCodeText>
            </p>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
          <span>
            {submissionTimeRangeLabel(minutes)}
            {includeHidden ? ", including hidden responses" : ""}
            {starredOnly ? ", starred responses only" : ""}
          </span>
          <span aria-hidden="true">•</span>
          <span>
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString()}`
              : "Loaded with page"}
          </span>
        </div>
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
                    {responseTime(submission.createdAt, hasHydrated)}
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
                  <InlineCodeText>{submission.text}</InlineCodeText>
                </p>
              ) : !submission.drawingData && !submission.gifData && !submission.image ? (
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
              {submission.image ? (
                <SubmissionImagePreview
                  key={submission.image.url}
                  url={submission.image.url}
                />
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
