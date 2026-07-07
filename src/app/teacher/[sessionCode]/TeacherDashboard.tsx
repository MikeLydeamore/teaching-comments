"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DrawingPreview } from "@/components/DrawingPreview";
import { ResponseTimePlot } from "@/components/ResponseTimePlot";
import { ResultsChart, type ChartType } from "@/components/ResultsChart";
import { responseCounts } from "@/lib/poll-results";
import type { DrawingData } from "@/lib/qwt-store";
import { logoutTeacher } from "../actions";

type Session = {
  code: string;
  title: string;
  prompt: string;
  promptUpdatedAt: string;
};

type Submission = {
  id: string;
  text: string;
  drawingData: DrawingData | null;
  status: "visible" | "hidden";
  starred: boolean;
  flagged: boolean;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  visible: number;
  hidden: number;
  starred: number;
  flagged: number;
  latestAt?: string;
};

type TeacherDashboardProps = {
  session: Session;
  initialStats: Stats;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "for",
  "in",
  "is",
  "it",
  "no",
  "not",
  "of",
  "or",
  "so",
  "that",
  "the",
  "there",
  "this",
  "to",
  "with",
]);

function minutesAgo(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

function topWords(submissions: Submission[]) {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    for (const word of submission.text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? []) {
      if (!stopWords.has(word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
}

export function TeacherDashboard({ session, initialStats }: TeacherDashboardProps) {
  const [sessionDetails, setSessionDetails] = useState(session);
  const [promptDraft, setPromptDraft] = useState(session.prompt);
  const [promptStatus, setPromptStatus] = useState("");
  const [minutes, setMinutes] = useState(3);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showResultsChart, setShowResultsChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("column");
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({
      minutes: String(minutes),
      includeHidden: String(includeHidden),
    });

    const [submissionsResponse, sessionResponse] = await Promise.all([
      fetch(`/api/sessions/${session.code}/submissions?${query}`),
      fetch(`/api/sessions/${session.code}`),
    ]);

    const submissionsPayload = await submissionsResponse.json();
    const sessionPayload = await sessionResponse.json();

    setSubmissions(submissionsPayload.submissions ?? []);
    if (sessionPayload.session) {
      setSessionDetails(sessionPayload.session);
    }
    setStats(sessionPayload.stats ?? initialStats);
    setLastRefresh(new Date());
    setIsLoading(false);
  }, [includeHidden, initialStats, minutes, session.code]);

  async function savePrompt() {
    setPromptStatus("Saving...");
    const response = await fetch(`/api/sessions/${session.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: promptDraft }),
    });
    const payload = await response.json();

    if (!response.ok) {
      setPromptStatus(payload.error ?? "Could not save prompt.");
      return;
    }

    setSessionDetails(payload.session);
    setPromptDraft(payload.session.prompt);
    setStats(payload.stats ?? stats);
    setPromptStatus("Prompt saved.");
  }

  async function patchSubmission(id: string, patch: Partial<Submission>) {
    const response = await fetch(`/api/submissions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        error: payload.error ?? "Could not update submission.",
        ok: false,
      };
    }

    await refresh();

    return { ok: true };
  }

  function startEditingSubmission(submission: Submission) {
    setEditingSubmissionId(submission.id);
    setEditDraft(submission.text);
    setEditError("");
  }

  function cancelEditingSubmission() {
    setEditingSubmissionId(null);
    setEditDraft("");
    setEditError("");
  }

  async function saveEditedSubmission(id: string) {
    setSavingEditId(id);
    setEditError("");
    const result = await patchSubmission(id, { text: editDraft });
    setSavingEditId(null);

    if (!result.ok) {
      setEditError(result.error);
      return;
    }

    cancelEditingSubmission();
  }

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

  const wordCounts = useMemo(() => topWords(submissions), [submissions]);
  const maxWordCount = Math.max(1, ...wordCounts.map(([, count]) => count));
  const pollResults = useMemo(() => responseCounts(submissions), [submissions]);
  const maxPollCount = Math.max(1, ...pollResults.map(([, count]) => count));
  const pollResponseTotal = pollResults.reduce((sum, [, count]) => sum + count, 0);
  const resultsUrl = `/teacher/${session.code}/results?${new URLSearchParams({
    chartType,
    includeHidden: String(includeHidden),
    minutes: String(minutes),
  }).toString()}`;

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
              Teacher view
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-normal text-slate-950">
              {sessionDetails.title}
            </h1>
          </div>
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            href={`/s/${session.code}`}
          >
            Open student page
          </Link>
          <Link
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
            href="/teacher"
          >
            Select session
          </Link>
          <form action={logoutTeacher}>
            <input name="next" type="hidden" value="/teacher" />
            <button
              className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
              type="submit"
            >
              Lock
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-5 px-5 py-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-500">Prompt</p>
              <p className="text-xs text-slate-500">Shown to students</p>
            </div>
            <label className="sr-only" htmlFor="prompt">
              Session prompt
            </label>
            <textarea
              id="prompt"
              className="mt-3 min-h-32 w-full resize-y rounded-md border border-slate-300 p-3 text-sm leading-6 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              maxLength={1200}
              value={promptDraft}
              onChange={(event) => {
                setPromptDraft(event.target.value);
                setPromptStatus("");
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {promptDraft.length}/1200
              </p>
              <button
                className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={promptDraft.trim() === sessionDetails.prompt}
                onClick={savePrompt}
                type="button"
              >
                Save prompt
              </button>
            </div>
            {promptStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">{promptStatus}</p>
            ) : null}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Controls</p>
            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="minutes">
              Show writings from last
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="minutes"
                className="h-10 w-20 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                min={1}
                max={500}
                type="number"
                value={minutes}
                onChange={(event) => setMinutes(Number(event.target.value))}
              />
              <span className="text-sm text-slate-600">minutes</span>
              <button
                className="ml-auto h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                onClick={refresh}
                type="button"
              >
                Refresh
              </button>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
              <input
                checked={includeHidden}
                className="size-4 rounded border-slate-300"
                type="checkbox"
                onChange={(event) => setIncludeHidden(event.target.checked)}
              />
              Include hidden
            </label>
            <p className="mt-3 text-xs text-slate-500">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : "Waiting for first refresh"}
            </p>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Session totals</p>
            <dl className="mt-3 grid grid-cols-2 gap-3">
              {[
                ["Total", stats.total],
                ["Visible", stats.visible],
                ["Starred", stats.starred],
                ["Flagged", stats.flagged],
              ].map(([label, value]) => (
                <div className="rounded-md border border-slate-200 p-3" key={label}>
                  <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold text-slate-950">{value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Common words</p>
            <div className="mt-3 space-y-2">
              {wordCounts.length ? (
                wordCounts.map(([word, count]) => (
                  <div className="grid grid-cols-[80px_1fr_28px] items-center gap-2 text-sm" key={word}>
                    <span className="truncate text-slate-700">{word}</span>
                    <span className="h-2 rounded-full bg-slate-100">
                      <span
                        className="block h-2 rounded-full bg-teal-600"
                        style={{ width: `${(count / maxWordCount) * 100}%` }}
                      />
                    </span>
                    <span className="text-right font-medium text-slate-700">{count}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No words to summarise yet.</p>
              )}
            </div>
          </section>
        </aside>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">
              Live writing stream
            </h2>
            <div className="flex items-center gap-3">
              <p className="text-sm text-slate-500">
                {isLoading ? "Loading..." : `${submissions.length} shown`}
              </p>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={() => setShowResultsChart((isShown) => !isShown)}
              >
                {showResultsChart ? "Hide results" : "Visualise results"}
              </button>
            </div>
          </div>

          {showResultsChart ? (
            <section className="mb-4 rounded-md border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-950">
                    Response chart
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Current view
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    aria-label="Chart type"
                    className="flex rounded-md border border-slate-300 bg-slate-50 p-1"
                  >
                    {(["column", "pie"] as const).map((type) => (
                      <button
                        className={`h-8 rounded px-3 text-sm font-semibold transition ${
                          chartType === type
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:text-teal-800"
                        }`}
                        key={type}
                        type="button"
                        onClick={() => setChartType(type)}
                      >
                        {type === "column" ? "Column" : "Pie"}
                      </button>
                    ))}
                  </div>
                  <p className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    {pollResponseTotal} typed
                  </p>
                  <Link
                    className={`rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-teal-500 hover:text-teal-800 ${
                      pollResults.length
                        ? "text-slate-700"
                        : "pointer-events-none cursor-not-allowed text-slate-400 opacity-50"
                    }`}
                    href={resultsUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Pop out
                  </Link>
                </div>
              </div>
              <ResultsChart
                chartType={chartType}
                maxCount={maxPollCount}
                results={pollResults}
                total={pollResponseTotal}
              />
              <ResponseTimePlot
                promptUpdatedAt={sessionDetails.promptUpdatedAt}
                submissions={submissions}
              />
            </section>
          ) : null}

          {submissions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {submissions.map((submission) => (
                <article
                  className={`rounded-md border bg-white p-4 shadow-sm ${
                    submission.status === "hidden" ? "border-slate-200 opacity-60" : "border-slate-300"
                  }`}
                  key={submission.id}
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      {minutesAgo(submission.createdAt)}
                    </p>
                    <div className="flex gap-1">
                      <button
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          submission.starred
                            ? "border-amber-300 bg-amber-100 text-amber-900"
                            : "border-slate-200 text-slate-600 hover:border-amber-300"
                        }`}
                        onClick={() => patchSubmission(submission.id, { starred: !submission.starred })}
                        type="button"
                      >
                        Star
                      </button>
                      <button
                        className={`rounded-md border px-2 py-1 text-xs font-semibold ${
                          submission.flagged
                            ? "border-red-300 bg-red-100 text-red-900"
                            : "border-slate-200 text-slate-600 hover:border-red-300"
                        }`}
                        onClick={() => patchSubmission(submission.id, { flagged: !submission.flagged })}
                        type="button"
                      >
                        Flag
                      </button>
                    </div>
                  </div>
                  {editingSubmissionId === submission.id ? (
                    <div>
                      <label className="sr-only" htmlFor={`edit-${submission.id}`}>
                        Edit response
                      </label>
                      <textarea
                        className="min-h-32 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-base leading-7 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                        id={`edit-${submission.id}`}
                        maxLength={2000}
                        value={editDraft}
                        onChange={(event) => {
                          setEditDraft(event.target.value);
                          setEditError("");
                        }}
                      />
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">
                          {2000 - editDraft.length} characters remaining
                        </p>
                        <div className="flex gap-2">
                          <button
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={savingEditId === submission.id}
                            type="button"
                            onClick={cancelEditingSubmission}
                          >
                            Cancel
                          </button>
                          <button
                            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={savingEditId === submission.id}
                            type="button"
                            onClick={() => saveEditedSubmission(submission.id)}
                          >
                            {savingEditId === submission.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </div>
                      {editError ? (
                        <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
                          {editError}
                        </p>
                      ) : null}
                    </div>
                  ) : submission.text ? (
                    <p className="min-h-28 whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-base leading-7 text-slate-950">
                      {submission.text}
                    </p>
                  ) : (
                    <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600">
                      Drawing-only response
                    </p>
                  )}
                  {submission.drawingData ? (
                    <DrawingPreview drawingData={submission.drawingData} />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                      type="button"
                      onClick={() => startEditingSubmission(submission)}
                    >
                      Edit
                    </button>
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                      onClick={() =>
                        patchSubmission(submission.id, {
                          status: submission.status === "hidden" ? "visible" : "hidden",
                        })
                      }
                      type="button"
                    >
                      {submission.status === "hidden" ? "Show response" : "Hide response"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No submissions in this time window yet.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
