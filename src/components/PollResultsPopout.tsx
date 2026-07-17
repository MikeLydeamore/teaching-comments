"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SessionTimer } from "@/components/SessionTimer";
import type { PollResults, SessionPoll } from "@/lib/qwt-store";

type PollResultsPopoutProps = {
  dashboardUrl: string;
  initialPoll: SessionPoll | null;
  initialResults: PollResults | null;
  sessionCode: string;
  sessionTitle: string;
};

export function PollResultsPopout({
  dashboardUrl,
  initialPoll,
  initialResults,
  sessionCode,
  sessionTitle,
}: PollResultsPopoutProps) {
  const [poll, setPoll] = useState(initialPoll);
  const [results, setResults] = useState(initialResults);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/sessions/${sessionCode}/polls`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as {
      poll?: SessionPoll | null;
      results?: PollResults | null;
    };

    setPoll(payload.poll ?? null);
    setResults(payload.results ?? null);
  }, [sessionCode]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refresh();
    }, 2000);

    return () => window.clearInterval(timer);
  }, [refresh]);

  const maxResultCount = useMemo(
    () =>
      Math.max(
        1,
        ...(results?.options.map((option) => option.responseCount) ?? []),
      ),
    [results],
  );

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-5 text-slate-950 sm:px-8 sm:py-7">
      <header className="flex flex-wrap items-start justify-between gap-5 border-b border-slate-300 pb-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
            Ed.ie live poll
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal sm:text-5xl">
            {sessionTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {poll?.status === "active" ? (
            <SessionTimer timerEndsAt={poll.endsAt} />
          ) : null}
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            href={dashboardUrl}
          >
            Dashboard
          </Link>
        </div>
      </header>

      {poll && results ? (
        <section className="mx-auto mt-8 w-full max-w-6xl">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <h2 className="max-w-5xl text-3xl font-semibold leading-tight sm:text-5xl">
              {poll.question}
            </h2>
            <p className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-3 text-lg font-semibold tabular-nums text-slate-700">
              {results.responseCount} response
              {results.responseCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-10 space-y-7" aria-live="polite">
            {results.options.map((option) => (
              <div key={option.id}>
                <div className="flex items-end justify-between gap-5">
                  <p className="min-w-0 break-words text-2xl font-semibold sm:text-3xl">
                    {option.label}
                  </p>
                  <p className="shrink-0 text-3xl font-semibold tabular-nums text-slate-700 sm:text-4xl">
                    {option.responseCount}
                  </p>
                </div>
                <div className="mt-3 h-8 overflow-hidden rounded bg-white shadow-inner sm:h-10">
                  <div
                    className="h-full rounded bg-teal-600 transition-[width] duration-300"
                    style={{
                      width: `${(option.responseCount / maxResultCount) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="mt-8 rounded-md border border-dashed border-slate-300 bg-white p-12 text-center text-xl font-medium text-slate-500">
          No poll results yet.
        </section>
      )}
    </main>
  );
}
