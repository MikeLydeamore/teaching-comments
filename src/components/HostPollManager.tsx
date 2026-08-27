"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InlineCodeText } from "@/components/InlineCodeText";
import { SessionTimer } from "@/components/SessionTimer";
import { TimerDurationInput } from "@/components/TimerDurationInput";
import type {
  PollQuestionBankItem,
  PollResults,
  PollSelectionMode,
  SessionPoll,
} from "@/lib/edie-store";
import {
  clampTimerSeconds,
  formatTimerSeconds,
  parseTimerDurationInput,
  POLL_TIMER_MIN_SECONDS,
  QUICK_TIMER_ADJUSTMENTS,
} from "@/lib/timer-duration";

type HostPollManagerProps = {
  dashboardUrl: string;
  sessionIsOpen: boolean;
  sessionCode: string;
};

const pollExtensions = [15, 30, 60];
const pollQuickAdjustments = [-5, -15, -30, 5, 15, 30];
const activePollRefreshIntervalMs = 3_000;
const idlePollRefreshIntervalMs = 15_000;
const pollQuestionBankRefreshIntervalMs = 10_000;

function pollIsCurrentlyLive(poll: SessionPoll, nowMs: number) {
  return (
    poll.status === "active" && new Date(poll.endsAt).getTime() > nowMs
  );
}

function csvCell(value: string | number) {
  let text = String(value);

  if (/^\s*[=+\-@]/.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function downloadPollResults(results: PollResults) {
  const { poll } = results;
  const rows: Array<Array<string | number>> = [
    ["Poll question", poll.question],
    ["Selection mode", poll.selectionMode],
    ["Started at", poll.startedAt],
    ["Ended at", poll.endedAt ?? poll.endsAt],
    ["Respondents", results.responseCount],
    [],
    ["Answer", "Responses", "Percent of respondents"],
    ...results.options.map((option) => [
      option.label,
      option.responseCount,
      results.responseCount
        ? `${((option.responseCount / results.responseCount) * 100).toFixed(1)}%`
        : "0.0%",
    ]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const downloadUrl = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const link = document.createElement("a");
  const timestamp = poll.startedAt.replaceAll(":", "-").replace(".000Z", "Z");

  link.href = downloadUrl;
  link.download = `poll-results-${timestamp}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
}

function sortPollQuestionBank(questions: PollQuestionBankItem[]) {
  return [...questions].sort((left, right) =>
    left.title.localeCompare(right.title),
  );
}

function questionBankTextKey(text: string) {
  return text.trim().toLowerCase();
}

export function HostPollManager({
  dashboardUrl,
  sessionIsOpen,
  sessionCode,
}: HostPollManagerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"current" | "history" | "new">("new");
  const [poll, setPoll] = useState<SessionPoll | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [history, setHistory] = useState<PollResults[]>([]);
  const [selectedHistoryPollId, setSelectedHistoryPollId] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [nowMs, setNowMs] = useState(0);
  const [question, setQuestion] = useState("");
  const [selectionMode, setSelectionMode] =
    useState<PollSelectionMode>("single");
  const [options, setOptions] = useState(["", ""]);
  const [correctOptionIndexes, setCorrectOptionIndexes] = useState<number[]>([]);
  const [pollQuestionBank, setPollQuestionBank] = useState<
    PollQuestionBankItem[]
  >([]);
  const [selectedBankQuestionId, setSelectedBankQuestionId] = useState("");
  const [bankStatus, setBankStatus] = useState("");
  const [isBankSaving, setIsBankSaving] = useState(false);
  const [isBankTitleDialogOpen, setIsBankTitleDialogOpen] = useState(false);
  const [bankTitleDraft, setBankTitleDraft] = useState("");
  const [durationSeconds, setDurationSeconds] = useState(30);
  const [durationDraftValue, setDurationDraftValue] = useState(
    formatTimerSeconds(30),
  );
  const [durationWasMinClamped, setDurationWasMinClamped] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [status, setStatus] = useState("");
  const pollQuestionBankRefreshRequestIdRef = useRef(0);

  const refreshPoll = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionCode}/polls`);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        return;
      }

      setPoll(payload.poll ?? null);
      setResults(payload.results ?? null);
    } catch {
      return;
    }
  }, [sessionCode]);

  const refreshPollQuestionBank = useCallback(async (reportErrors = false) => {
    const requestId = ++pollQuestionBankRefreshRequestIdRef.current;

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/poll-questions`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));

      if (requestId !== pollQuestionBankRefreshRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        if (reportErrors) {
          setBankStatus(
            payload.error ?? "Could not load the poll question bank.",
          );
        }
        return;
      }

      const nextQuestionBank = sortPollQuestionBank(
        payload.pollQuestionBank ?? [],
      );
      setPollQuestionBank(nextQuestionBank);
      setSelectedBankQuestionId((currentId) =>
        nextQuestionBank.some((question) => question.id === currentId)
          ? currentId
          : "",
      );
    } catch {
      if (
        reportErrors &&
        requestId === pollQuestionBankRefreshRequestIdRef.current
      ) {
        setBankStatus("Could not load the poll question bank.");
      }
    }
  }, [sessionCode]);

  const refreshHistory = useCallback(async () => {
    setIsHistoryLoading(true);
    setHistoryStatus("");

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/polls/history`,
        { cache: "no-store" },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setHistoryStatus(payload.error ?? "Could not load past polls.");
        return;
      }

      const nextHistory = (payload.history ?? []) as PollResults[];
      const currentTime = Date.now();
      const firstPastPoll = nextHistory.find(
        (item) => !pollIsCurrentlyLive(item.poll, currentTime),
      );

      setHistory(nextHistory);
      setSelectedHistoryPollId((currentId) =>
        nextHistory.some(
          (item) =>
            item.poll.id === currentId &&
            !pollIsCurrentlyLive(item.poll, currentTime),
        )
          ? currentId
          : (firstPastPoll?.poll.id ?? ""),
      );
    } catch {
      setHistoryStatus("Could not load past polls.");
    } finally {
      setIsHistoryLoading(false);
    }
  }, [sessionCode]);

  const pollIsLive = Boolean(
    poll && nowMs > 0 && pollIsCurrentlyLive(poll, nowMs),
  );
  const pollRefreshIntervalMs = pollIsLive
    ? activePollRefreshIntervalMs
    : idlePollRefreshIntervalMs;

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refreshPoll();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPoll();
      }
    }, pollRefreshIntervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshPoll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollRefreshIntervalMs, refreshPoll]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const firstRefresh = window.setTimeout(() => {
      void refreshPollQuestionBank(true);
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPollQuestionBank();
      }
    }, pollQuestionBankRefreshIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshPollQuestionBank();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isOpen, refreshPollQuestionBank]);

  useEffect(() => {
    const updateTime = () => setNowMs(Date.now());
    const firstUpdate = window.setTimeout(updateTime, 0);
    const timer = window.setInterval(updateTime, 250);

    return () => {
      window.clearTimeout(firstUpdate);
      window.clearInterval(timer);
    };
  }, []);

  const pollNeedsEnding = poll?.status === "active";
  const pastPollResults = useMemo(
    () =>
      history.filter(
        (item) => nowMs > 0 && !pollIsCurrentlyLive(item.poll, nowMs),
      ),
    [history, nowMs],
  );
  const selectedHistoryResults =
    pastPollResults.find(
      (item) => item.poll.id === selectedHistoryPollId,
    ) ?? pastPollResults[0] ?? null;
  const maxHistoryResultCount = Math.max(
    1,
    ...(selectedHistoryResults?.options.map(
      (option) => option.responseCount,
    ) ?? []),
  );
  const maxResultCount = useMemo(
    () =>
      Math.max(1, ...(results?.options.map((option) => option.responseCount) ?? [])),
    [results],
  );
  const parsedDraftSeconds = parseTimerDurationInput(durationDraftValue);
  const canStart =
    sessionIsOpen &&
    !pollNeedsEnding &&
    question.trim().length > 0 &&
    options.length >= 2 &&
    options.every((option) => option.trim().length > 0) &&
    (selectionMode !== "single" || correctOptionIndexes.length === 1) &&
    parsedDraftSeconds !== null;
  const normalizedBankOptions = options.map((option) => option.trim());
  const canAddToBank =
    question.trim().length >= 1 &&
    question.trim().length <= 500 &&
    normalizedBankOptions.length >= 2 &&
    normalizedBankOptions.length <= 8 &&
    normalizedBankOptions.every(
      (option) => option.length >= 1 && option.length <= 160,
    ) &&
    new Set(normalizedBankOptions.map((option) => option.toLowerCase())).size ===
      normalizedBankOptions.length;
  const duplicateBankQuestion = pollQuestionBank.find(
    (bankQuestion) =>
      questionBankTextKey(bankQuestion.question) ===
      questionBankTextKey(question),
  );
  const canAddNewQuestionToBank = canAddToBank && !duplicateBankQuestion;
  const canUpdateQuestionInBank =
    canAddToBank &&
    (!duplicateBankQuestion || duplicateBankQuestion.id === selectedBankQuestionId);
  const hasValidSingleChoiceSolution =
    selectionMode !== "single" || correctOptionIndexes.length === 1;
  const solutionIsVisible = Boolean(
    poll &&
      (poll.solutionRevealed ||
        (nowMs > 0 && new Date(poll.endsAt).getTime() <= nowMs)),
  );

  function openManager() {
    setTab(poll ? "current" : "new");
    setStatus("");
    setIsOpen(true);
    void refreshPoll();
    void refreshHistory();
  }

  async function startPoll() {
    if (!canStart || isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus("Starting poll...");

    const nextSeconds = clampTimerSeconds(
      parsedDraftSeconds ?? durationSeconds,
      POLL_TIMER_MIN_SECONDS,
    );
    setDurationSeconds(nextSeconds);
    setDurationDraftValue(formatTimerSeconds(nextSeconds));
    setDurationWasMinClamped(false);

    try {
      const response = await fetch(`/api/sessions/${sessionCode}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          durationSeconds: nextSeconds,
          correctOptionIndexes,
          options,
          question,
          selectionMode,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(payload.error ?? "Could not start poll.");
        return;
      }

      setPoll(payload.poll);
      setResults(payload.results);
      setQuestion("");
      setOptions(["", ""]);
      setCorrectOptionIndexes([]);
      setSelectedBankQuestionId("");
      setBankStatus("");
      setTab("current");
      setStatus("Poll started.");
      void refreshHistory();
    } catch {
      setStatus("Could not start poll.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updatePoll(
    action: "end" | "extend" | "reveal-solution" | "restart",
    seconds?: number,
  ) {
    if (!poll || isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus(
      action === "end"
        ? "Ending poll..."
        : action === "reveal-solution"
          ? "Revealing solutions..."
          : action === "restart"
            ? "Restarting poll..."
            : "Extending poll...",
    );

    try {
      const response = await fetch(`/api/polls/${poll.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, seconds }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setStatus(payload.error ?? "Could not update poll.");
        return;
      }

      setPoll(payload.poll);
      setResults(payload.results);
      setStatus(
        action === "end"
          ? "Poll ended."
          : action === "reveal-solution"
            ? "Solutions revealed."
            : action === "restart"
              ? "Poll restarted."
              : `Added ${seconds} seconds.`,
      );
      if (action === "end" || action === "restart") {
        void refreshHistory();
      }
    } catch {
      setStatus("Could not update poll.");
    } finally {
      setIsSaving(false);
    }
  }

  async function restartHistoryPoll() {
    const historyPoll = selectedHistoryResults?.poll;
    if (!historyPoll || isSaving) return;
    setIsSaving(true);
    setHistoryStatus("Restarting poll...");
    try {
      const response = await fetch(`/api/polls/${historyPoll.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "restart" }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setHistoryStatus(payload.error ?? "Could not restart poll.");
        return;
      }
      setPoll(payload.poll);
      setResults(payload.results);
      setTab("current");
      setStatus("Poll restarted.");
      setHistoryStatus("");
      void refreshHistory();
      void refreshPoll();
    } catch {
      setHistoryStatus("Could not restart poll.");
    } finally {
      setIsSaving(false);
    }
  }

  function updateOption(index: number, value: string) {
    setBankStatus("");
    setOptions((currentOptions) =>
      currentOptions.map((option, optionIndex) =>
        optionIndex === index ? value : option,
      ),
    );
  }

  function loadBankQuestion(id: string) {
    setSelectedBankQuestionId(id);
    setBankStatus("");

    if (!id) {
      return;
    }

    const bankQuestion = pollQuestionBank.find((item) => item.id === id);

    if (!bankQuestion) {
      return;
    }

    setQuestion(bankQuestion.question);
    setSelectionMode(bankQuestion.selectionMode);
    setOptions([...bankQuestion.options]);
    setCorrectOptionIndexes([...bankQuestion.correctOptionIndexes]);
  }

  async function addCurrentPollToBank() {
    const title = bankTitleDraft.trim();

    if (
      !canAddNewQuestionToBank ||
      !title ||
      title.length > 500 ||
      isBankSaving
    ) {
      return;
    }

    setIsBankSaving(true);
    setBankStatus("Adding poll question...");

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/poll-questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            correctOptionIndexes,
            options,
            question,
            selectionMode,
            title,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBankStatus(payload.error ?? "Could not add poll question.");
        await refreshPollQuestionBank();
        return;
      }

      const bankQuestion = payload.bankQuestion as PollQuestionBankItem;
      setPollQuestionBank((currentBank) =>
        sortPollQuestionBank([...currentBank, bankQuestion]),
      );
      setSelectedBankQuestionId(bankQuestion.id);
      setBankStatus("Poll question added to bank.");
      setIsBankTitleDialogOpen(false);
      await refreshPollQuestionBank();
    } catch {
      setBankStatus("Could not add poll question.");
    } finally {
      setIsBankSaving(false);
    }
  }

  async function updateCurrentPollInBank() {
    if (
      !selectedBankQuestionId ||
      !canUpdateQuestionInBank ||
      !hasValidSingleChoiceSolution ||
      isBankSaving
    ) {
      return;
    }

    setIsBankSaving(true);
    setBankStatus("Updating poll question...");

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/poll-questions/${encodeURIComponent(selectedBankQuestionId)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            correctOptionIndexes,
            options,
            question,
            selectionMode,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBankStatus(payload.error ?? "Could not update poll question.");
        await refreshPollQuestionBank();
        return;
      }

      const bankQuestion = payload.bankQuestion as PollQuestionBankItem;
      setPollQuestionBank((currentBank) =>
        sortPollQuestionBank(
          currentBank.map((item) =>
            item.id === bankQuestion.id ? bankQuestion : item,
          ),
        ),
      );
      setBankStatus("Poll question updated.");
      await refreshPollQuestionBank();
    } catch {
      setBankStatus("Could not update poll question.");
    } finally {
      setIsBankSaving(false);
    }
  }

  async function deleteSelectedBankQuestion() {
    if (!selectedBankQuestionId || isBankSaving) {
      return;
    }

    setIsBankSaving(true);
    setBankStatus("Deleting poll question...");

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/poll-questions/${encodeURIComponent(selectedBankQuestionId)}`,
        { method: "DELETE" },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setBankStatus(payload.error ?? "Could not delete poll question.");
        await refreshPollQuestionBank();
        return;
      }

      setPollQuestionBank((currentBank) =>
        currentBank.filter(
          (bankQuestion) => bankQuestion.id !== selectedBankQuestionId,
        ),
      );
      setSelectedBankQuestionId("");
      setBankStatus("Poll question deleted.");
      await refreshPollQuestionBank();
    } catch {
      setBankStatus("Could not delete poll question.");
    } finally {
      setIsBankSaving(false);
    }
  }

  function setPollDuration(seconds: number) {
    const nextSeconds = clampTimerSeconds(seconds, POLL_TIMER_MIN_SECONDS);

    setDurationSeconds(nextSeconds);
    setDurationDraftValue(formatTimerSeconds(nextSeconds));
    setDurationWasMinClamped(seconds < POLL_TIMER_MIN_SECONDS);
    setStatus("");
  }

  function adjustPollDuration(seconds: number) {
    const baseSeconds =
      seconds > 0 && durationWasMinClamped ? 0 : durationSeconds;

    setPollDuration(baseSeconds + seconds);
  }

  function popOutResults() {
    const popoutWindow = window.open(
      `${dashboardUrl}/poll`,
      "edie-poll-results-popout",
    );

    popoutWindow?.focus();
  }

  return (
    <>
      <button
        className={`rounded-md border px-3 py-2 text-sm font-semibold transition ${
          pollIsLive
            ? "border-teal-400 bg-teal-50 text-teal-900 hover:bg-teal-100"
            : "border-slate-300 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-800"
        }`}
        disabled={!sessionIsOpen && !pollNeedsEnding}
        type="button"
        onClick={openManager}
      >
        {pollIsLive
          ? `Poll live (${results?.responseCount ?? 0})`
          : pollNeedsEnding
            ? "Poll ready to end"
            : !sessionIsOpen
            ? "Session closed"
          : "Run poll"}
      </button>

      {isOpen ? (
        <div
          aria-labelledby="host-poll-title"
          aria-modal="true"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 sm:p-6"
          role="dialog"
        >
          <section className="my-auto w-full max-w-3xl rounded-md bg-white shadow-xl">
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.14em] text-teal-700">
                  Polling mode
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold text-slate-950"
                  id="host-poll-title"
                >
                  Live poll
                </h2>
              </div>
              <button
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500"
                type="button"
                onClick={() => {
                  setIsBankTitleDialogOpen(false);
                  setIsOpen(false);
                }}
              >
                Close
              </button>
            </header>

            <div className="grid grid-cols-3 border-b border-slate-200 bg-slate-50 p-1">
              {(["current", "history", "new"] as const).map((tabOption) => (
                <button
                  className={`h-10 rounded text-sm font-semibold transition ${
                    tab === tabOption
                      ? "bg-white text-slate-950 shadow-sm"
                      : "text-slate-600 hover:text-teal-800"
                  }`}
                  key={tabOption}
                  type="button"
                  onClick={() => {
                    setTab(tabOption);
                    setStatus("");
                    if (tabOption === "history") {
                      void refreshHistory();
                    }
                  }}
                >
                  {tabOption === "current"
                    ? "Current poll"
                    : tabOption === "history"
                      ? "Past polls"
                      : "New poll"}
                </button>
              ))}
            </div>

            <div className="max-h-[75vh] overflow-y-auto p-5 sm:p-6">
              {tab === "current" ? (
                poll && results ? (
                  <div>
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${
                              pollIsLive
                                ? "bg-teal-100 text-teal-900"
                                : "bg-slate-200 text-slate-700"
                            }`}
                          >
                            {pollIsLive
                              ? "Live"
                              : poll.status === "ended"
                                ? "Ended"
                                : "Time ended"}
                          </span>
                          <span className="text-sm text-slate-500">
                            {poll.selectionMode === "single"
                              ? "Single choice"
                              : "Multiple choice"}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold leading-7 text-slate-950">
                          <InlineCodeText>{poll.question}</InlineCodeText>
                        </h3>
                      </div>
                      {poll.status === "active" ? (
                        <SessionTimer timerEndsAt={poll.endsAt} />
                      ) : (
                        <div className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600">
                          <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                            Poll ended
                          </p>
                          <p className="text-xl font-semibold tabular-nums">0:00</p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 space-y-4">
                      {results.options.map((option) => (
                        <div key={option.id}>
                          <div className="flex items-end justify-between gap-4 text-sm">
                            <span className="min-w-0 break-words font-medium text-slate-800">
                              <InlineCodeText>{option.label}</InlineCodeText>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                              {option.responseCount}
                            </span>
                          </div>
                          <div
                            className={`mt-1 h-4 overflow-hidden rounded bg-slate-100 ${
                              solutionIsVisible && poll.correctOptionIds.includes(option.id)
                                ? "ring-2 ring-green-600 ring-offset-2"
                                : ""
                            }`}
                          >
                            <div
                              className="h-full rounded bg-teal-600 transition-[width]"
                              style={{
                                width: `${(option.responseCount / maxResultCount) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-4">
                      <p className="text-sm font-semibold text-slate-700">
                        {results.responseCount} response
                        {results.responseCount === 1 ? "" : "s"}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                          type="button"
                          onClick={popOutResults}
                        >
                          Pop out results
                        </button>
                        <button
                          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                          type="button"
                          onClick={() => downloadPollResults(results)}
                        >
                          Download CSV
                        </button>
                        {!solutionIsVisible && poll.correctOptionIds.length > 0 ? (
                          <button
                            className="h-10 rounded-md border border-green-300 px-3 text-sm font-semibold text-green-800 transition hover:border-green-500 disabled:opacity-60"
                            disabled={isSaving}
                            type="button"
                            onClick={() => void updatePoll("reveal-solution")}
                          >
                            Reveal solution
                          </button>
                        ) : null}
                        {poll.status === "active" ? (
                          <>
                          {pollIsLive ? pollExtensions.map((seconds) => (
                            <button
                              className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:opacity-60"
                              disabled={isSaving}
                              key={seconds}
                              type="button"
                              onClick={() => void updatePoll("extend", seconds)}
                            >
                              +{seconds}s
                            </button>
                          )                          ) : (
                            <button
                              className="h-10 rounded-md border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-900 transition hover:border-teal-500 disabled:opacity-60"
                              disabled={isSaving || !sessionIsOpen}
                              type="button"
                              onClick={() => void updatePoll("restart")}
                              title="Restart poll with same answers"
                            >
                              Restart poll
                            </button>
                          )}
                          <button
                            className="h-10 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-700 transition hover:border-red-400 disabled:opacity-60"
                            disabled={isSaving}
                            type="button"
                            onClick={() => void updatePoll("end")}
                          >
                            End poll
                          </button>
                          </>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <button
                              className="h-10 rounded-md border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-900 transition hover:border-teal-500 disabled:opacity-60"
                              disabled={isSaving || !sessionIsOpen}
                              type="button"
                              onClick={() => void updatePoll("restart")}
                              title="Restart poll with same answers"
                            >
                              Restart poll
                            </button>
                            <button
                              className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                              type="button"
                              onClick={() => setTab("new")}
                            >
                              Create another poll
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-10 text-center">
                    <p className="text-sm text-slate-500">No polls yet.</p>
                    <button
                      className="mt-4 h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white"
                      type="button"
                      onClick={() => setTab("new")}
                    >
                      Create poll
                    </button>
                  </div>
                )
              ) : tab === "history" ? (
                <div>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <label
                        className="block text-sm font-semibold text-slate-700"
                        htmlFor="past-poll"
                      >
                        Poll
                      </label>
                      <select
                        className="mt-2 h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                        disabled={!pastPollResults.length || isHistoryLoading}
                        id="past-poll"
                        value={selectedHistoryResults?.poll.id ?? ""}
                        onChange={(event) =>
                          setSelectedHistoryPollId(event.target.value)
                        }
                      >
                        {!pastPollResults.length ? (
                          <option value="">No past polls</option>
                        ) : null}
                        {pastPollResults.map((item) => (
                          <option key={item.poll.id} value={item.poll.id}>
                            {new Date(item.poll.startedAt).toLocaleString()} — {item.poll.question}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isHistoryLoading}
                      type="button"
                      onClick={() => void refreshHistory()}
                    >
                      {isHistoryLoading ? "Refreshing..." : "Refresh"}
                    </button>
                  </div>

                  {historyStatus ? (
                    <p
                      aria-live="polite"
                      className="mt-3 text-sm font-medium text-red-700"
                    >
                      {historyStatus}
                    </p>
                  ) : null}

                  {selectedHistoryResults ? (
                    <section className="mt-6 border-t border-slate-200 pt-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                            <span>
                              {selectedHistoryResults.poll.selectionMode === "single"
                                ? "Single choice"
                                : "Multiple choice"}
                            </span>
                            <span aria-hidden="true">•</span>
                            <time dateTime={selectedHistoryResults.poll.startedAt}>
                              {new Date(
                                selectedHistoryResults.poll.startedAt,
                              ).toLocaleString()}
                            </time>
                          </div>
                          <h3 className="mt-2 text-xl font-semibold leading-7 text-slate-950">
                            <InlineCodeText>
                              {selectedHistoryResults.poll.question}
                            </InlineCodeText>
                          </h3>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            className="h-10 rounded-md border border-teal-300 bg-teal-50 px-3 text-sm font-semibold text-teal-900 transition hover:border-teal-500 disabled:opacity-60"
                            disabled={isSaving || !sessionIsOpen}
                            type="button"
                            onClick={() => void restartHistoryPoll()}
                            title="Restart poll with same answers"
                          >
                            Restart poll
                          </button>
                          <button
                            className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                            type="button"
                            onClick={() =>
                              downloadPollResults(selectedHistoryResults)
                            }
                          >
                            Download CSV
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 space-y-4">
                        {selectedHistoryResults.options.map((option) => (
                          <div key={option.id}>
                            <div className="flex items-end justify-between gap-4 text-sm">
                              <span className="min-w-0 break-words font-medium text-slate-800">
                                <InlineCodeText>{option.label}</InlineCodeText>
                              </span>
                              <span className="shrink-0 font-semibold tabular-nums text-slate-700">
                                {option.responseCount}
                              </span>
                            </div>
                            <div
                              className={`mt-1 h-4 overflow-hidden rounded bg-slate-100 ${
                                selectedHistoryResults.poll.correctOptionIds.includes(option.id)
                                  ? "ring-2 ring-green-600 ring-offset-2"
                                  : ""
                              }`}
                            >
                              <div
                                className="h-full rounded bg-teal-600"
                                style={{
                                  width: `${(option.responseCount / maxHistoryResultCount) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="mt-6 border-t border-slate-200 pt-4 text-sm font-semibold text-slate-700">
                        {selectedHistoryResults.responseCount} response
                        {selectedHistoryResults.responseCount === 1 ? "" : "s"}
                      </p>
                    </section>
                  ) : !isHistoryLoading && !historyStatus ? (
                    <div className="py-12 text-center">
                      <p className="text-sm text-slate-500">
                        No past polls yet. End the current poll or run another
                        poll to build the history.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div>
                  {!sessionIsOpen ? (
                    <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                      Reopen the session before starting a poll.
                    </p>
                  ) : null}
                  {pollIsLive ? (
                    <p className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
                      End the current poll before starting another.
                    </p>
                  ) : null}

                  <section className="mb-5 rounded-md border border-slate-200 bg-slate-50 p-4">
                    <label
                      className="block text-sm font-semibold text-slate-700"
                      htmlFor="poll-question-bank"
                    >
                      Poll question bank
                    </label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                      <select
                        className="h-11 min-w-0 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                        id="poll-question-bank"
                        value={selectedBankQuestionId}
                        onChange={(event) => loadBankQuestion(event.target.value)}
                      >
                        <option value="">Select a saved poll question</option>
                        {pollQuestionBank.map((bankQuestion) => (
                          <option key={bankQuestion.id} value={bankQuestion.id}>
                            {bankQuestion.title} (
                            {bankQuestion.selectionMode === "single"
                              ? "single"
                              : "multiple"}
                            )
                          </option>
                        ))}
                      </select>
                      <button
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          !canAddNewQuestionToBank ||
                          !hasValidSingleChoiceSolution ||
                          isBankSaving
                        }
                        type="button"
                        onClick={() => {
                          setBankTitleDraft(question);
                          setBankStatus("");
                          setIsBankTitleDialogOpen(true);
                        }}
                      >
                        Add to bank
                      </button>
                      <button
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={
                          !selectedBankQuestionId ||
                          !canUpdateQuestionInBank ||
                          !hasValidSingleChoiceSolution ||
                          isBankSaving
                        }
                        type="button"
                        onClick={() => void updateCurrentPollInBank()}
                      >
                        Update saved
                      </button>
                      <button
                        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-red-700 transition hover:border-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={!selectedBankQuestionId || isBankSaving}
                        type="button"
                        onClick={() => void deleteSelectedBankQuestion()}
                      >
                        Delete
                      </button>
                    </div>
                    {bankStatus ? (
                      <p
                        aria-live="polite"
                        className={`mt-2 text-sm font-medium ${
                          bankStatus.startsWith("Could not")
                            ? "text-red-700"
                            : "text-slate-600"
                        }`}
                      >
                        {bankStatus}
                      </p>
                    ) : null}
                  </section>

                  <label className="block text-sm font-semibold text-slate-700" htmlFor="poll-question">
                    Question
                  </label>
                  <textarea
                    className="mt-2 min-h-24 w-full resize-y rounded-md border border-slate-300 p-3 text-base leading-6 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                    id="poll-question"
                    maxLength={500}
                    placeholder="Ask the group..."
                    value={question}
                    onChange={(event) => {
                      setQuestion(event.target.value);
                      setBankStatus("");
                      setStatus("");
                    }}
                  />

                  <p className="mt-5 text-sm font-semibold text-slate-700">Answer type</p>
                  <div className="mt-2 grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1">
                    {(["single", "multiple"] as const).map((mode) => (
                      <button
                        className={`h-10 rounded text-sm font-semibold transition ${
                          selectionMode === mode
                            ? "bg-white text-slate-950 shadow-sm"
                            : "text-slate-600 hover:text-teal-800"
                        }`}
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSelectionMode(mode);
                          setCorrectOptionIndexes((currentIndexes) =>
                            mode === "single"
                              ? currentIndexes.slice(0, 1)
                              : currentIndexes,
                          );
                          setBankStatus("");
                        }}
                      >
                        {mode === "single" ? "Single choice" : "Multiple choice"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-700">Answers</p>
                    <button
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:opacity-50"
                      disabled={options.length >= 8}
                      type="button"
                      onClick={() => {
                        setOptions((currentOptions) => [...currentOptions, ""]);
                        setBankStatus("");
                      }}
                    >
                      Add answer
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {options.map((option, index) => (
                      <div className="flex items-center gap-2" key={index}>
                        <span className="w-6 text-right text-sm font-semibold text-slate-500">
                          {index + 1}
                        </span>
                        <input
                          aria-label={`Answer ${index + 1}`}
                          className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                          maxLength={160}
                          value={option}
                          onChange={(event) => updateOption(index, event.target.value)}
                        />
                        <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-slate-700">
                          <input
                            aria-label={`Correct answer ${index + 1}`}
                            checked={correctOptionIndexes.includes(index)}
                            className="size-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500"
                            type="checkbox"
                            onChange={(event) => {
                              setCorrectOptionIndexes((currentIndexes) => {
                                if (!event.target.checked) {
                                  return currentIndexes.filter(
                                    (item) => item !== index,
                                  );
                                }
                                return selectionMode === "single"
                                  ? [index]
                                  : [...currentIndexes, index];
                              });
                              setBankStatus("");
                            }}
                          />
                          Correct
                        </label>
                        <button
                          aria-label={`Remove answer ${index + 1}`}
                          className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-600 transition hover:border-red-300 hover:text-red-700 disabled:opacity-40"
                          disabled={options.length <= 2}
                          title={`Remove answer ${index + 1}`}
                          type="button"
                          onClick={() =>
                            {
                              setOptions((currentOptions) =>
                                currentOptions.filter((_, optionIndex) => optionIndex !== index),
                              );
                              setCorrectOptionIndexes((currentIndexes) =>
                                currentIndexes
                                  .filter((item) => item !== index)
                                  .map((item) => (item > index ? item - 1 : item)),
                              );
                              setBankStatus("");
                            }
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  {selectionMode === "single" && !hasValidSingleChoiceSolution ? (
                    <p className="mt-2 text-sm font-medium text-amber-800">
                      Mark exactly one correct answer before starting or saving this poll.
                    </p>
                  ) : null}

                  <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <label className="text-sm font-semibold text-slate-700" htmlFor="poll-duration">
                        Timer (minutes:seconds or seconds)
                      </label>
                      <div className="mt-2">
                        <TimerDurationInput
                          id="poll-duration"
                          value={durationDraftValue}
                          onValueChange={(value) => {
                            setDurationDraftValue(value);
                            setDurationWasMinClamped(false);
                            setStatus("");
                          }}
                          onCommit={(seconds) => {
                            if (seconds !== null) {
                              setPollDuration(seconds);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {QUICK_TIMER_ADJUSTMENTS.map((seconds) => (
                        <button
                          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-400 hover:text-teal-800"
                          key={seconds}
                          type="button"
                          onClick={() => adjustPollDuration(seconds)}
                        >
                          {seconds > 0 ? "+" : ""}
                          {seconds}s
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
                    <p
                      aria-live="polite"
                      className={`text-sm font-medium ${
                        status.startsWith("Could not") || status.includes("must")
                          ? "text-red-700"
                          : "text-slate-600"
                      }`}
                    >
                      {status}
                    </p>
                    <button
                      className="h-11 rounded-md bg-amber-300 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={!canStart || isSaving}
                      type="button"
                      onClick={() => void startPoll()}
                    >
                      {isSaving ? "Starting..." : "Start poll"}
                    </button>
                  </div>
                </div>
              )}

              {tab === "current" && status ? (
                <p className="mt-4 text-sm font-medium text-slate-600" aria-live="polite">
                  {status}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}
      {isBankTitleDialogOpen ? (
        <div
          aria-labelledby="poll-bank-title-dialog-heading"
          aria-modal="true"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-5"
          role="dialog"
        >
          <section className="w-full max-w-lg rounded-md bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-teal-700">
                  Poll question bank
                </p>
                <h2
                  className="mt-1 text-xl font-semibold text-slate-950"
                  id="poll-bank-title-dialog-heading"
                >
                  Add a title
                </h2>
              </div>
              <button
                aria-label="Close title dialog"
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                disabled={isBankSaving}
                type="button"
                onClick={() => setIsBankTitleDialogOpen(false)}
              >
                Close
              </button>
            </div>
            <label
              className="mt-5 block text-sm font-semibold text-slate-700"
              htmlFor="poll-bank-title"
            >
              Title
            </label>
            <input
              autoFocus
              className="mt-2 h-11 w-full rounded-md border border-slate-300 px-3 text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
              id="poll-bank-title"
              maxLength={500}
              value={bankTitleDraft}
              onChange={(event) => {
                setBankTitleDraft(event.target.value);
                setBankStatus("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCurrentPollToBank();
                }
              }}
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This title appears in the bank. The full question is still
              stored.
            </p>
            {bankStatus ? (
              <p
                aria-live="polite"
                className={`mt-3 text-sm font-medium ${
                  bankStatus.startsWith("Could not")
                    ? "text-red-700"
                    : "text-slate-600"
                }`}
              >
                {bankStatus}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-500 disabled:opacity-50"
                disabled={isBankSaving}
                type="button"
                onClick={() => setIsBankTitleDialogOpen(false)}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  !bankTitleDraft.trim() ||
                  bankTitleDraft.trim().length > 500 ||
                  isBankSaving
                }
                type="button"
                onClick={() => void addCurrentPollToBank()}
              >
                {isBankSaving ? "Adding..." : "Add to bank"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
