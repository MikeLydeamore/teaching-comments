"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import { GroupQuestionsPanel } from "@/components/GroupQuestionsPanel";
import { ResponseTimePlot } from "@/components/ResponseTimePlot";
import { ResultsChart, type ChartType } from "@/components/ResultsChart";
import { SessionTimer, formatTimerSeconds } from "@/components/SessionTimer";
import { responseCounts, responseWordCounts } from "@/lib/poll-results";
import type { DrawingData, GifData, QuestionBankItem } from "@/lib/qwt-store";
import { logoutTeacher } from "../actions";

type Session = {
  code: string;
  title: string;
  prompt: string;
  promptUpdatedAt: string;
  timerDurationSeconds: number;
  timerEndsAt: string | null;
};

type Submission = {
  id: string;
  studentName: string;
  text: string;
  drawingData: DrawingData | null;
  gifData: GifData | null;
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
  initialQuestionBank: QuestionBankItem[];
  session: Session;
  initialStats: Stats;
};

type SubmissionSortOrder = "newest" | "oldest";

const submissionSortOptions: { label: string; value: SubmissionSortOrder }[] = [
  { label: "Newest first", value: "newest" },
  { label: "Oldest first", value: "oldest" },
];

const chartTypeOptions: { label: string; value: ChartType }[] = [
  { label: "Column", value: "column" },
  { label: "Pie", value: "pie" },
  { label: "Word cloud", value: "wordCloud" },
];

const TIMER_MIN_SECONDS = 1;
const timerQuickAdjustments = [-5, -15, -30, 5, 15, 30];

function minutesAgo(value: string) {
  const elapsed = Date.now() - new Date(value).getTime();
  const minutes = Math.max(0, Math.floor(elapsed / 60000));

  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 min ago";
  return `${minutes} min ago`;
}

function CopyStatusIcon({ isCopied }: { isCopied: boolean }) {
  if (isCopied) {
    return (
      <svg
        aria-hidden="true"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
      >
        <path d="m5 12 4 4L19 6" />
      </svg>
    );
  }

  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <rect height="14" rx="2" width="14" x="8" y="8" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function StarIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill={isActive ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M11.5 2.8a.6.6 0 0 1 1 0l2.7 5.5 6.1.9a.6.6 0 0 1 .3 1l-4.4 4.3 1 6.1a.6.6 0 0 1-.9.6L12 18.3l-5.4 2.9a.6.6 0 0 1-.9-.6l1-6.1-4.4-4.3a.6.6 0 0 1 .3-1l6.1-.9 2.8-5.5Z" />
    </svg>
  );
}

function FlagIcon({ isActive }: { isActive: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill={isActive ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M5 21V4" />
      <path d="M5 4h12l-1.5 4L17 12H5" />
    </svg>
  );
}

function shouldSkipCardDrag(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "button, a, input, textarea, select, [data-no-card-drag='true']",
      ),
    )
  );
}

function clampTimerSeconds(seconds: number) {
  if (!Number.isFinite(seconds)) {
    return 30;
  }

  return Math.min(3600, Math.max(TIMER_MIN_SECONDS, Math.round(seconds)));
}

function parseTimerDurationInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(":");

  if (parts.length !== 2) {
    return null;
  }

  const minutes = Number(parts[0] || "0");
  const seconds = Number(parts[1]);

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return null;
  }

  return minutes * 60 + seconds;
}

async function writeTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.left = "-9999px";
  textArea.style.position = "fixed";
  textArea.style.top = "0";
  document.body.appendChild(textArea);
  textArea.select();

  const didCopy = document.execCommand("copy");
  document.body.removeChild(textArea);

  if (!didCopy) {
    throw new Error("Could not copy response.");
  }
}

function sortSubmissionsForOrder(
  submissions: Submission[],
  submissionSortOrder: SubmissionSortOrder,
) {
  return [...submissions].sort((a, b) => {
    const aTime = new Date(a.createdAt).getTime();
    const bTime = new Date(b.createdAt).getTime();

    return submissionSortOrder === "newest" ? bTime - aTime : aTime - bTime;
  });
}

function submissionIdsForOrder(
  submissions: Submission[],
  submissionSortOrder: SubmissionSortOrder,
) {
  return sortSubmissionsForOrder(submissions, submissionSortOrder).map(
    (submission) => submission.id,
  );
}

function mergeSubmissionOrder(
  currentOrder: string[],
  nextSubmissions: Submission[],
  submissionSortOrder: SubmissionSortOrder,
) {
  const nextIds = submissionIdsForOrder(nextSubmissions, submissionSortOrder);
  const nextIdSet = new Set(nextIds);
  const keptIds = currentOrder.filter((id) => nextIdSet.has(id));
  const keptIdSet = new Set(keptIds);
  const newIds = nextIds.filter((id) => !keptIdSet.has(id));

  return submissionSortOrder === "newest"
    ? [...newIds, ...keptIds]
    : [...keptIds, ...newIds];
}

function reorderSubmissionIds(order: string[], draggedId: string, targetId: string) {
  if (draggedId === targetId) {
    return order;
  }

  const currentIndex = order.indexOf(draggedId);
  const targetIndex = order.indexOf(targetId);

  if (currentIndex === -1 || targetIndex === -1) {
    return order;
  }

  const nextOrder = order.filter((id) => id !== draggedId);
  const insertIndex = nextOrder.indexOf(targetId) + (currentIndex < targetIndex ? 1 : 0);

  if (insertIndex === -1) {
    return order;
  }

  nextOrder.splice(insertIndex, 0, draggedId);
  return nextOrder;
}

function sortQuestionBank(questionBank: QuestionBankItem[]) {
  return [...questionBank].sort((a, b) => a.title.localeCompare(b.title));
}

export function TeacherDashboard({
  initialQuestionBank,
  session,
  initialStats,
}: TeacherDashboardProps) {
  const [sessionDetails, setSessionDetails] = useState(session);
  const [promptDraft, setPromptDraft] = useState(session.prompt);
  const [promptStatus, setPromptStatus] = useState("");
  const [questionBank, setQuestionBank] = useState(() =>
    sortQuestionBank(initialQuestionBank),
  );
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [questionBankStatus, setQuestionBankStatus] = useState("");
  const [isQuestionTitleDialogOpen, setIsQuestionTitleDialogOpen] =
    useState(false);
  const [questionTitleDraft, setQuestionTitleDraft] = useState("");
  const [minutes, setMinutes] = useState(3);
  const [includeHidden, setIncludeHidden] = useState(false);
  const [starredOnly, setStarredOnly] = useState(false);
  const [submissionSortOrder, setSubmissionSortOrder] =
    useState<SubmissionSortOrder>("newest");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [orderedSubmissionIds, setOrderedSubmissionIds] = useState<string[]>([]);
  const [draggedSubmissionId, setDraggedSubmissionId] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showResultsChart, setShowResultsChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("column");
  const [timerDraftSeconds, setTimerDraftSeconds] = useState(30);
  const [timerDraftValue, setTimerDraftValue] = useState(formatTimerSeconds(30));
  const [timerDraftWasMinClamped, setTimerDraftWasMinClamped] = useState(false);
  const [timerStatus, setTimerStatus] = useState("");
  const [copiedSubmissionId, setCopiedSubmissionId] = useState<string | null>(null);
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

    const nextSubmissions = submissionsPayload.submissions ?? [];

    setSubmissions(nextSubmissions);
    setOrderedSubmissionIds((currentOrder) =>
      mergeSubmissionOrder(currentOrder, nextSubmissions, submissionSortOrder),
    );
    if (sessionPayload.session) {
      setSessionDetails(sessionPayload.session);
    }
    setStats(sessionPayload.stats ?? initialStats);
    setLastRefresh(new Date());
    setIsLoading(false);
  }, [includeHidden, initialStats, minutes, session.code, submissionSortOrder]);

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

  function openQuestionTitleDialog() {
    const promptText = promptDraft.trim();

    if (questionBank.some((question) => question.text === promptText)) {
      setQuestionBankStatus("That question is already in the bank.");
      return;
    }

    setQuestionTitleDraft(promptText);
    setQuestionBankStatus("");
    setIsQuestionTitleDialogOpen(true);
  }

  async function addPromptToBank() {
    const promptText = promptDraft.trim();
    const questionTitle = questionTitleDraft.trim() || promptText;

    setQuestionBankStatus("Adding question...");
    const response = await fetch(`/api/sessions/${session.code}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: promptText, title: questionTitle }),
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setQuestionBankStatus(payload.error ?? "Could not add question.");
      return;
    }

    const nextQuestion = payload.question as QuestionBankItem;
    setQuestionBank((currentQuestionBank) =>
      sortQuestionBank([...currentQuestionBank, nextQuestion]),
    );
    setSelectedQuestionId(nextQuestion.id);
    setIsQuestionTitleDialogOpen(false);
    setQuestionTitleDraft("");
    setQuestionBankStatus("Question added to bank.");
  }

  function selectQuestionFromBank(questionId: string) {
    setSelectedQuestionId(questionId);
    setQuestionBankStatus("");

    const question = questionBank.find((bankQuestion) => bankQuestion.id === questionId);

    if (!question) {
      return;
    }

    setPromptDraft(question.text);
    setPromptStatus("Question loaded. Save prompt to show students.");
  }

  async function deleteSelectedQuestionFromBank() {
    const question = questionBank.find(
      (bankQuestion) => bankQuestion.id === selectedQuestionId,
    );

    if (!question) {
      return;
    }

    setQuestionBankStatus("Deleting question...");
    const response = await fetch(`/api/questions/${encodeURIComponent(question.id)}`, {
      method: "DELETE",
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      setQuestionBankStatus(payload.error ?? "Could not delete question.");
      return;
    }

    setQuestionBank((currentQuestionBank) =>
      currentQuestionBank.filter((bankQuestion) => bankQuestion.id !== question.id),
    );
    setSelectedQuestionId("");
    setQuestionBankStatus("Question deleted from bank.");
  }

  async function patchSession(patch: Record<string, unknown>, loadingMessage: string) {
    setTimerStatus(loadingMessage);
    const response = await fetch(`/api/sessions/${session.code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const payload = await response.json();

    if (!response.ok) {
      setTimerStatus(payload.error ?? "Could not update timer.");
      return;
    }

    setSessionDetails(payload.session);
    setStats(payload.stats ?? stats);
    setTimerStatus("");
  }

  async function startTimer() {
    const parsedSeconds = parseTimerDurationInput(timerDraftValue);

    if (parsedSeconds === null) {
      setTimerStatus("Use minutes:seconds, like 1:30.");
      return;
    }

    const nextSeconds = clampTimerSeconds(parsedSeconds);
    setTimerDraftSeconds(nextSeconds);
    setTimerDraftValue(formatTimerSeconds(nextSeconds));
    setTimerDraftWasMinClamped(false);

    await patchSession(
      { timerDurationSeconds: nextSeconds },
      "Starting timer...",
    );
  }

  async function clearTimer() {
    await patchSession({ clearTimer: true }, "Clearing timer...");
  }

  function setTimerDraftDuration(seconds: number) {
    const nextSeconds = clampTimerSeconds(seconds);
    setTimerDraftSeconds(nextSeconds);
    setTimerDraftValue(formatTimerSeconds(nextSeconds));
    setTimerDraftWasMinClamped(seconds < TIMER_MIN_SECONDS);
    setTimerStatus("");
  }

  function normalizeTimerDraftValue() {
    const parsedSeconds = parseTimerDurationInput(timerDraftValue);

    if (parsedSeconds === null) {
      return;
    }

    setTimerDraftDuration(parsedSeconds);
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

  async function copySubmissionText(submission: Submission) {
    if (!submission.text) {
      return;
    }

    try {
      await writeTextToClipboard(submission.text);
    } catch {
      return;
    }

    setCopiedSubmissionId(submission.id);
    window.setTimeout(() => {
      setCopiedSubmissionId((currentId) =>
        currentId === submission.id ? null : currentId,
      );
    }, 1400);
  }

  function changeSubmissionSortOrder(nextSortOrder: SubmissionSortOrder) {
    setSubmissionSortOrder(nextSortOrder);
    setOrderedSubmissionIds(submissionIdsForOrder(submissions, nextSortOrder));
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

  const orderedSubmissions = useMemo(() => {
    const submissionsById = new Map(
      submissions.map((submission) => [submission.id, submission]),
    );
    const ordered = orderedSubmissionIds
      .map((id) => submissionsById.get(id))
      .filter((submission): submission is Submission => Boolean(submission));
    const orderedIds = new Set(ordered.map((submission) => submission.id));

    return [
      ...ordered,
      ...sortSubmissionsForOrder(
        submissions.filter((submission) => !orderedIds.has(submission.id)),
        submissionSortOrder,
      ),
    ];
  }, [orderedSubmissionIds, submissions, submissionSortOrder]);
  const displayedSubmissions = useMemo(
    () =>
      starredOnly
        ? orderedSubmissions.filter((submission) => submission.starred)
        : orderedSubmissions,
    [orderedSubmissions, starredOnly],
  );
  const wordCounts = useMemo(
    () => responseWordCounts(displayedSubmissions, 8),
    [displayedSubmissions],
  );
  const maxWordCount = Math.max(1, ...wordCounts.map(([, count]) => count));
  const pollResults = useMemo(
    () => responseCounts(displayedSubmissions),
    [displayedSubmissions],
  );
  const wordCloudResults = useMemo(
    () => responseWordCounts(displayedSubmissions),
    [displayedSubmissions],
  );
  const chartResults = chartType === "wordCloud" ? wordCloudResults : pollResults;
  const maxPollCount = Math.max(1, ...chartResults.map(([, count]) => count));
  const pollResponseTotal = chartResults.reduce((sum, [, count]) => sum + count, 0);
  const selectedQuestion = questionBank.find(
    (question) => question.id === selectedQuestionId,
  );
  const promptDraftText = promptDraft.trim();
  const promptIsAlreadyInBank = questionBank.some(
    (question) => question.text === promptDraftText,
  );
  const canAddPromptToBank =
    promptDraftText.length >= 5 &&
    promptDraftText.length <= 1200 &&
    !promptIsAlreadyInBank;
  const questionTitleDraftText = questionTitleDraft.trim();
  const canConfirmQuestionTitle =
    questionTitleDraftText.length >= 1 && questionTitleDraftText.length <= 1200;
  const isAddingQuestion = questionBankStatus === "Adding question...";
  const resultsUrl = `/teacher/${session.code}/results?${new URLSearchParams({
    chartType,
    includeHidden: String(includeHidden),
    minutes: String(minutes),
    starredOnly: String(starredOnly),
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
            <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="question-bank">
              Question bank
            </label>
            <div className="mt-2 flex items-center gap-2">
              <select
                className="h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                id="question-bank"
                value={selectedQuestionId}
                onChange={(event) => selectQuestionFromBank(event.target.value)}
              >
                <option value="">
                  {questionBank.length ? "Select a saved question" : "No saved questions"}
                </option>
                {questionBank.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.title}
                  </option>
                ))}
              </select>
              <button
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedQuestion}
                type="button"
                onClick={() => {
                  void deleteSelectedQuestionFromBank();
                }}
              >
                Delete
              </button>
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
                const nextPromptDraft = event.target.value;
                setPromptDraft(nextPromptDraft);
                if (
                  selectedQuestion &&
                  nextPromptDraft.trim() !== selectedQuestion.text
                ) {
                  setSelectedQuestionId("");
                }
                setQuestionBankStatus("");
                setPromptStatus("");
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {promptDraft.length}/1200
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={!canAddPromptToBank}
                  type="button"
                  onClick={openQuestionTitleDialog}
                >
                  Add to bank
                </button>
                <button
                  className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={promptDraft.trim() === sessionDetails.prompt}
                  onClick={savePrompt}
                  type="button"
                >
                  Show
                </button>
              </div>
            </div>
            {questionBankStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {questionBankStatus}
              </p>
            ) : null}
            {promptStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">{promptStatus}</p>
            ) : null}
          </section>

          <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-500">Timer</p>
              <p className="text-xs text-slate-500">Shown to students</p>
            </div>
            <div className="mt-3">
              <SessionTimer
                idleText="No active timer"
                timerEndsAt={sessionDetails.timerEndsAt}
              />
            </div>
            <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="timer-duration">
              Current timer
            </label>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="timer-duration"
                className="h-10 w-24 rounded-md border border-slate-300 px-3 font-mono tabular-nums text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                inputMode="numeric"
                placeholder="0:30"
                value={timerDraftValue}
                onBlur={normalizeTimerDraftValue}
                onChange={(event) => {
                  setTimerDraftValue(event.target.value);
                  setTimerDraftWasMinClamped(false);
                  setTimerStatus("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void startTimer();
                  }
                }}
              />
              <button
                className="h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                type="button"
                onClick={() => {
                  void startTimer();
                }}
              >
                Start
              </button>
              <button
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                type="button"
                onClick={() => {
                  void clearTimer();
                }}
              >
                Clear
              </button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {timerQuickAdjustments.map((seconds) => (
                <button
                  className="h-9 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                  key={seconds}
                  type="button"
                  onClick={() => {
                    const parsedSeconds =
                      parseTimerDurationInput(timerDraftValue) ?? timerDraftSeconds;
                    const baseSeconds =
                      seconds > 0 && timerDraftWasMinClamped ? 0 : parsedSeconds;

                    setTimerDraftDuration(baseSeconds + seconds);
                  }}
                >
                  {seconds > 0 ? "+" : ""}
                  {seconds}s
                </button>
              ))}
            </div>
            {timerStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">{timerStatus}</p>
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
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Card order</p>
              <div
                aria-label="Card order"
                className="mt-2 grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1"
              >
                {submissionSortOptions.map((option) => (
                  <button
                    className={`h-9 rounded px-2 text-sm font-semibold transition ${
                      submissionSortOrder === option.value
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-600 hover:text-teal-800"
                    }`}
                    key={option.value}
                    type="button"
                    onClick={() => changeSubmissionSortOrder(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              className={`mt-4 h-10 w-full rounded-md border px-3 text-sm font-semibold transition ${
                starredOnly
                  ? "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-50"
                  : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-900"
              }`}
              type="button"
              onClick={() => setStarredOnly((isStarredOnly) => !isStarredOnly)}
            >
              {starredOnly ? "Showing starred only" : "Show starred only"}
            </button>
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
                {isLoading ? "Loading..." : `${displayedSubmissions.length} shown`}
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

          <div className="mb-4">
            <GroupQuestionsPanel sessionCode={session.code} variant="teacher" />
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
                    {chartTypeOptions.map((option) => (
                      <button
                        className={`h-8 rounded px-3 text-sm font-semibold transition ${
                          chartType === option.value
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:text-teal-800"
                        }`}
                        key={option.value}
                        type="button"
                        onClick={() => setChartType(option.value)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <p className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
                    {pollResponseTotal} {chartType === "wordCloud" ? "words" : "typed"}
                  </p>
                  <Link
                    className={`rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold transition hover:border-teal-500 hover:text-teal-800 ${
                      chartResults.length
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
                results={chartResults}
                total={pollResponseTotal}
              />
              <ResponseTimePlot
                promptUpdatedAt={sessionDetails.promptUpdatedAt}
                submissions={displayedSubmissions}
              />
            </section>
          ) : null}

          {displayedSubmissions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {displayedSubmissions.map((submission) => (
                <div
                  className="cursor-grab active:cursor-grabbing"
                  draggable
                  key={submission.id}
                  title="Drag the card edge to reorder"
                  onDragEnd={() => setDraggedSubmissionId(null)}
                  onDragOver={(event) => {
                    if (draggedSubmissionId && draggedSubmissionId !== submission.id) {
                      event.preventDefault();
                      event.dataTransfer.dropEffect = "move";
                    }
                  }}
                  onDragStart={(event) => {
                    if (shouldSkipCardDrag(event.target)) {
                      event.preventDefault();
                      setDraggedSubmissionId(null);
                      return;
                    }

                    setDraggedSubmissionId(submission.id);
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", submission.id);
                  }}
                  onDrop={(event) => {
                    const draggedId =
                      event.dataTransfer.getData("text/plain") || draggedSubmissionId;

                    if (!draggedId || draggedId === submission.id) {
                      return;
                    }

                    event.preventDefault();
                    setOrderedSubmissionIds((currentOrder) =>
                      reorderSubmissionIds(
                        mergeSubmissionOrder(
                          currentOrder,
                          submissions,
                          submissionSortOrder,
                        ),
                        draggedId,
                        submission.id,
                      ),
                    );
                    setDraggedSubmissionId(null);
                  }}
                >
                  <p className="mb-1 truncate px-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {submission.studentName || "Anonymous"}
                  </p>
                  <article
                    className={`rounded-md border bg-white p-4 shadow-sm ${
                      draggedSubmissionId === submission.id
                        ? "border-teal-400 opacity-60 ring-4 ring-teal-100"
                        : submission.status === "hidden"
                          ? "border-slate-200 opacity-60"
                          : "border-slate-300"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      {minutesAgo(submission.createdAt)}
                    </p>
                    <div className="flex gap-1" data-no-card-drag="true">
                      <button
                        aria-label={
                          submission.starred ? "Remove star from response" : "Star response"
                        }
                        className={`flex size-8 items-center justify-center rounded-md border transition ${
                          submission.starred
                            ? "border-amber-300 bg-amber-100 text-amber-900"
                            : "border-slate-200 text-slate-600 hover:border-amber-300"
                        }`}
                        title={submission.starred ? "Remove star" : "Star"}
                        onClick={() => patchSubmission(submission.id, { starred: !submission.starred })}
                        type="button"
                      >
                        <StarIcon isActive={submission.starred} />
                      </button>
                      <button
                        aria-label={
                          submission.flagged ? "Remove flag from response" : "Flag response"
                        }
                        className={`flex size-8 items-center justify-center rounded-md border transition ${
                          submission.flagged
                            ? "border-red-300 bg-red-100 text-red-900"
                            : "border-slate-200 text-slate-600 hover:border-red-300"
                        }`}
                        title={submission.flagged ? "Remove flag" : "Flag"}
                        onClick={() => patchSubmission(submission.id, { flagged: !submission.flagged })}
                        type="button"
                      >
                        <FlagIcon isActive={submission.flagged} />
                      </button>
                    </div>
                  </div>
                  {editingSubmissionId === submission.id ? (
                    <div data-no-card-drag="true">
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
                    <div
                      className="relative min-h-28 cursor-auto rounded-md border border-slate-200 bg-slate-50 p-3 pr-12 text-base leading-7 text-slate-950"
                      data-no-card-drag="true"
                    >
                      <button
                        aria-label="Copy response to clipboard"
                        className={`absolute right-2 top-2 flex size-8 items-center justify-center rounded-md border text-slate-600 transition ${
                          copiedSubmissionId === submission.id
                            ? "border-teal-300 bg-teal-50 text-teal-800"
                            : "border-slate-200 bg-white hover:border-teal-300 hover:text-teal-800"
                        }`}
                        title={
                          copiedSubmissionId === submission.id
                            ? "Copied"
                            : "Copy to clipboard"
                        }
                        type="button"
                        onClick={() => {
                          void copySubmissionText(submission);
                        }}
                      >
                        <CopyStatusIcon isCopied={copiedSubmissionId === submission.id} />
                      </button>
                      <p className="whitespace-pre-wrap">{submission.text}</p>
                    </div>
                  ) : !submission.drawingData && !submission.gifData ? (
                    <p
                      className="cursor-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-600"
                      data-no-card-drag="true"
                    >
                      Media-only response
                    </p>
                  ) : null}
                  {submission.gifData ? (
                    <div className="cursor-auto" data-no-card-drag="true">
                      <GifPreview gifData={submission.gifData} />
                    </div>
                  ) : null}
                  {submission.drawingData ? (
                    <div className="cursor-auto" data-no-card-drag="true">
                      <DrawingPreview drawingData={submission.drawingData} />
                    </div>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2" data-no-card-drag="true">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              {starredOnly
                ? "No starred submissions in this time window yet."
                : "No submissions in this time window yet."}
            </div>
          )}
        </section>
      </div>
      {isQuestionTitleDialogOpen ? (
        <div
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-5"
          role="dialog"
        >
          <div className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">
                  Save question
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  This title appears in the question bank selector.
                </p>
              </div>
              <button
                aria-label="Close"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                disabled={isAddingQuestion}
                type="button"
                onClick={() => {
                  setIsQuestionTitleDialogOpen(false);
                  setQuestionTitleDraft("");
                }}
              >
                Close
              </button>
            </div>
            <label className="mt-4 block text-sm font-semibold text-slate-700" htmlFor="question-title">
              Title
            </label>
            <textarea
              className="mt-2 min-h-28 w-full resize-y rounded-md border border-slate-300 bg-white p-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="question-title"
              maxLength={1200}
              value={questionTitleDraft}
              onChange={(event) => {
                setQuestionTitleDraft(event.target.value);
                setQuestionBankStatus("");
              }}
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {questionTitleDraft.length}/1200
              </p>
              <div className="flex gap-2">
                <button
                  className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={isAddingQuestion}
                  type="button"
                  onClick={() => {
                    setIsQuestionTitleDialogOpen(false);
                    setQuestionTitleDraft("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!canConfirmQuestionTitle || isAddingQuestion}
                  type="button"
                  onClick={() => {
                    void addPromptToBank();
                  }}
                >
                  {isAddingQuestion ? "Adding..." : "Add question"}
                </button>
              </div>
            </div>
            {questionBankStatus && questionBankStatus !== "Adding question..." ? (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {questionBankStatus}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
