"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import { GroupQuestionsPanel } from "@/components/GroupQuestionsPanel";
import { HostPollManager } from "@/components/HostPollManager";
import { InlineCodeText } from "@/components/InlineCodeText";
import { PendingActionButton } from "@/components/PendingActionButton";
import { ToastProvider, useToast } from "@/components/Toast";
import { ResponseTimePlot } from "@/components/ResponseTimePlot";
import { ResultsChart, type ChartType } from "@/components/ResultsChart";
import { SessionTimer, formatTimerSeconds } from "@/components/SessionTimer";
import { SubmissionImagePreview } from "@/components/SubmissionImagePreview";
import { responseCounts, responseWordCounts } from "@/lib/poll-results";
import type {
  DrawingData,
  GifData,
  SubmissionImageDto,
  PromptHistoryItem,
  QuestionBankItem,
} from "@/lib/edie-store";

type Session = {
  id: string;
  code: string;
  title: string;
  prompt: string;
  isOpen: boolean;
  promptUpdatedAt: string;
  groupQuestionsScreeningEnabled: boolean;
  submissionsScreeningEnabled: boolean;
  textInputEnabled: boolean;
  gifInputEnabled: boolean;
  drawingInputEnabled: boolean;
  imageInputEnabled: boolean;
  timerDurationSeconds: number;
  timerEndsAt: string | null;
};

type Submission = {
  id: string;
  studentName: string;
  text: string;
  drawingData: DrawingData | null;
  gifData: GifData | null;
  image: SubmissionImageDto | null;
  status: "visible" | "hidden";
  starred: boolean;
  flagged: boolean;
  archivedAt: string | null;
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

type ArchiveSummary = {
  archivedAt: string;
  groupQuestions: number;
  submissions: number;
};

type TeacherDashboardProps = {
  initialPromptHistory: PromptHistoryItem[];
  initialQuestionBank: QuestionBankItem[];
  session: Session;
  initialStats: Stats;
  spaceCode?: string;
  spaceName?: string;
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

function refreshStatus(value: Date | null) {
  if (!value) return "Waiting for first refresh";

  const seconds = Math.max(0, Math.floor((Date.now() - value.getTime()) / 1000));
  if (seconds < 5) return "Updated just now";
  if (seconds < 60) return `Updated ${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  return `Updated ${minutes}m ago`;
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

function promptHistoryOptionLabel(item: PromptHistoryItem) {
  const startedAt = new Date(item.startedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const prompt =
    item.prompt.length > 80 ? `${item.prompt.slice(0, 77).trim()}...` : item.prompt;

  return `${startedAt} - ${prompt}`;
}

export function TeacherDashboard(props: TeacherDashboardProps) {
  return (
    <ToastProvider>
      <TeacherDashboardContent {...props} />
    </ToastProvider>
  );
}

function TeacherDashboardContent({
  initialPromptHistory,
  initialQuestionBank,
  session,
  initialStats,
  spaceCode,
  spaceName,
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
  const [promptHistory, setPromptHistory] = useState(initialPromptHistory);
  const [selectedPromptHistoryId, setSelectedPromptHistoryId] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [submissionSortOrder, setSubmissionSortOrder] =
    useState<SubmissionSortOrder>("newest");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [orderedSubmissionIds, setOrderedSubmissionIds] = useState<string[]>([]);
  const [draggedSubmissionId, setDraggedSubmissionId] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [showLiveControls, setShowLiveControls] = useState(false);
  const [showResultsChart, setShowResultsChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("column");
  const [timerDraftSeconds, setTimerDraftSeconds] = useState(30);
  const [timerDraftValue, setTimerDraftValue] = useState(formatTimerSeconds(30));
  const [timerDraftWasMinClamped, setTimerDraftWasMinClamped] = useState(false);
  const [timerStatus, setTimerStatus] = useState("");
  const [inputSettingsStatus, setInputSettingsStatus] = useState("");
  const [isUpdatingSessionAccess, setIsUpdatingSessionAccess] = useState(false);
  const submissionsPopoutWindowRef = useRef<Window | null>(null);
  const [submissionsPopoutOpen, setSubmissionsPopoutOpen] = useState(false);
  const [copiedSubmissionId, setCopiedSubmissionId] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [archiveStatus, setArchiveStatus] = useState("");
  const [lastArchive, setLastArchive] = useState<ArchiveSummary | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isUnarchiving, setIsUnarchiving] = useState(false);
  const [questionsPanelKey, setQuestionsPanelKey] = useState(0);
  const [pendingOps, setPendingOps] = useState<string[]>([]);
  const toast = useToast();

  const beginOp = useCallback((key: string) => {
    setPendingOps((currentOps) =>
      currentOps.includes(key) ? currentOps : [...currentOps, key],
    );
  }, []);

  const endOp = useCallback((key: string) => {
    setPendingOps((currentOps) => currentOps.filter((op) => op !== key));
  }, []);

  const isPending = useCallback(
    (key: string) => pendingOps.includes(key),
    [pendingOps],
  );


  const refresh = useCallback(async (overrides?: { includeHidden?: boolean }) => {
    const effectiveIncludeHidden = overrides?.includeHidden ?? includeHidden;
    const query = new URLSearchParams({
      minutes: String(minutes),
      includeHidden: String(effectiveIncludeHidden),
    });

    if (selectedPromptHistoryId) {
      query.set("promptHistoryId", selectedPromptHistoryId);
    }

    let submissionsResponse: Response;
    let sessionResponse: Response;

    try {
      [submissionsResponse, sessionResponse] = await Promise.all([
        fetch(`/api/sessions/${session.id}/submissions?${query}`),
        fetch(`/api/sessions/${session.id}`),
      ]);
    } catch {
      setRefreshError("Could not refresh the dashboard. Trying again shortly.");
      setIsLoading(false);
      return;
    }

    const [submissionsPayload, sessionPayload] = await Promise.all([
      submissionsResponse.json().catch(() => ({})),
      sessionResponse.json().catch(() => ({})),
    ]);

    if (!submissionsResponse.ok || !sessionResponse.ok) {
      setRefreshError(
        submissionsPayload.error ??
          sessionPayload.error ??
          "Could not refresh the dashboard. Trying again shortly.",
      );
      setIsLoading(false);
      return;
    }

    const nextSubmissions = submissionsPayload.submissions ?? [];

    setSubmissions(nextSubmissions);
    setOrderedSubmissionIds((currentOrder) =>
      mergeSubmissionOrder(currentOrder, nextSubmissions, submissionSortOrder),
    );
    if (sessionPayload.session) {
      setSessionDetails(sessionPayload.session);
    }
    if (sessionPayload.promptHistory) {
      setPromptHistory(sessionPayload.promptHistory);
    }
    setStats(sessionPayload.stats ?? initialStats);
    setRefreshError("");
    setLastRefresh(new Date());
    setIsLoading(false);
  }, [
    includeHidden,
    initialStats,
    minutes,
    selectedPromptHistoryId,
    session.id,
    submissionSortOrder,
  ]);

  async function savePrompt() {
    if (isPending("save-prompt")) {
      return;
    }

    beginOp("save-prompt");
    setPromptStatus("Saving...");

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptDraft }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error ?? "Could not save prompt.";
        setPromptStatus(message);
        toast.error(message);
        return;
      }

      setSessionDetails(payload.session);
      setPromptDraft(payload.session.prompt);
      if (payload.promptHistory) {
        setPromptHistory(payload.promptHistory);
      }
      setStats(payload.stats ?? stats);
      setPromptStatus("Prompt saved.");
    } catch {
      setPromptStatus("Could not save prompt.");
      toast.error("Could not save prompt.");
    } finally {
      endOp("save-prompt");
    }
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
    const response = await fetch(`/api/sessions/${session.id}/questions`, {
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

    if (!question || isPending("delete-question")) {
      return;
    }

    beginOp("delete-question");
    setQuestionBankStatus("Deleting question...");

    try {
      const response = await fetch(`/api/questions/${encodeURIComponent(question.id)}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error ?? "Could not delete question.";
        setQuestionBankStatus(message);
        toast.error(message);
        return;
      }

      setQuestionBank((currentQuestionBank) =>
        currentQuestionBank.filter((bankQuestion) => bankQuestion.id !== question.id),
      );
      setSelectedQuestionId("");
      setQuestionBankStatus("Question deleted from bank.");
    } catch {
      setQuestionBankStatus("Could not delete question.");
      toast.error("Could not delete question.");
    } finally {
      endOp("delete-question");
    }
  }

  async function patchSession(
    patch: Record<string, unknown>,
    loadingMessage: string,
    opKey?: string,
  ) {
    if (opKey) {
      if (isPending(opKey)) {
        return;
      }

      beginOp(opKey);
    }

    setTimerStatus(loadingMessage);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error ?? "Could not update session.";
        setTimerStatus(message);
        toast.error(message);
        return;
      }

      setSessionDetails(payload.session);
      setStats(payload.stats ?? stats);
      setTimerStatus("");
    } catch {
      setTimerStatus("Could not update session.");
      toast.error("Could not update session.");
    } finally {
      if (opKey) {
        endOp(opKey);
      }
    }
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
      "timer-start",
    );
  }

  async function clearTimer() {
    await patchSession({ clearTimer: true }, "Clearing timer...", "timer-clear");
  }

  async function setGroupQuestionsScreeningMode(isEnabled: boolean) {
    const opKey = "screen-group-questions";

    if (isPending(opKey)) {
      return;
    }

    beginOp(opKey);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupQuestionsScreeningEnabled: isEnabled }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update screening.");
        return;
      }

      setSessionDetails(payload.session);
      setStats(payload.stats ?? stats);
    } catch {
      toast.error("Could not update screening.");
    } finally {
      endOp(opKey);
    }
  }

  async function setSubmissionsScreeningMode(isEnabled: boolean) {
    const opKey = "screen-submissions";

    if (isPending(opKey)) {
      return;
    }

    beginOp(opKey);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionsScreeningEnabled: isEnabled }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update screening.");
        return;
      }

      setSessionDetails(payload.session);
      setStats(payload.stats ?? stats);
    } catch {
      toast.error("Could not update screening.");
    } finally {
      endOp(opKey);
    }
  }

  async function setSubmissionInputEnabled(
    input: "textInputEnabled" | "gifInputEnabled" | "drawingInputEnabled" | "imageInputEnabled",
    isEnabled: boolean,
  ) {
    const opKey = `input-${input}`;

    if (isPending(opKey)) {
      return;
    }

    beginOp(opKey);
    setInputSettingsStatus("Saving...");

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [input]: isEnabled }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error ?? "Could not update response inputs.";
        setInputSettingsStatus(message);
        toast.error(message);
        return;
      }

      setSessionDetails(payload.session);
      setInputSettingsStatus("");
    } catch {
      setInputSettingsStatus("Could not update response inputs.");
      toast.error("Could not update response inputs.");
    } finally {
      endOp(opKey);
    }
  }

  async function setSessionOpen(isOpen: boolean) {
    if (isUpdatingSessionAccess) {
      return;
    }

    setIsUpdatingSessionAccess(true);

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        toast.error(payload.error ?? "Could not update session access.");
        return;
      }

      setSessionDetails(payload.session);
      setStats(payload.stats ?? stats);
      setQuestionsPanelKey((currentKey) => currentKey + 1);
    } catch {
      toast.error("Could not update session access.");
    } finally {
      setIsUpdatingSessionAccess(false);
    }
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

  async function patchSubmission(id: string, patch: Partial<Submission>, opKey?: string) {
    if (opKey) {
      if (isPending(opKey)) {
        return { error: "", ok: false };
      }

      beginOp(opKey);
    }

    try {
      const response = await fetch(`/api/submissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = payload.error ?? "Could not update submission.";

        toast.error(message);

        return {
          error: message,
          ok: false,
        };
      }

      await refresh();

      return { ok: true };
    } catch {
      toast.error("Could not update submission.");

      return {
        error: "Could not update submission.",
        ok: false,
      };
    } finally {
      if (opKey) {
        endOp(opKey);
      }
    }
  }

  function toggleSubmissionStar(submission: Submission) {
    return patchSubmission(
      submission.id,
      { starred: !submission.starred },
      `submission:${submission.id}:star`,
    );
  }

  function toggleSubmissionFlag(submission: Submission) {
    return patchSubmission(
      submission.id,
      { flagged: !submission.flagged },
      `submission:${submission.id}:flag`,
    );
  }

  function toggleSubmissionVisibility(submission: Submission) {
    return patchSubmission(
      submission.id,
      { status: submission.status === "hidden" ? "visible" : "hidden" },
      `submission:${submission.id}:status`,
    );
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

  async function archiveRoom() {
    const confirmed = window.confirm(
      "Archive current responses and group questions? They will disappear from the live room but remain in CSV export.",
    );

    if (!confirmed) {
      return;
    }

    setIsArchiving(true);
    setArchiveStatus("Archiving room...");

    const response = await fetch(`/api/sessions/${session.id}/archive`, {
      method: "POST",
    });
    const payload = await response.json().catch(() => ({}));

    setIsArchiving(false);

    if (!response.ok) {
      setArchiveStatus(payload.error ?? "Could not archive this room.");
      return;
    }

    const archive = payload.archive as ArchiveSummary | undefined;
    const archivedSubmissions = archive?.submissions ?? 0;
    const archivedQuestions = archive?.groupQuestions ?? 0;
    const archivedTotal = archivedSubmissions + archivedQuestions;

    setSubmissions([]);
    setOrderedSubmissionIds([]);
    setStats(payload.stats ?? stats);
    setQuestionsPanelKey((currentKey) => currentKey + 1);
    setLastArchive(archive && archivedTotal > 0 ? archive : null);
    setArchiveStatus(
      `Archived ${archivedSubmissions} response${archivedSubmissions === 1 ? "" : "s"} and ${archivedQuestions} question${archivedQuestions === 1 ? "" : "s"}.`,
    );
    await refresh();
  }

  async function unarchiveRoom() {
    if (!lastArchive) {
      return;
    }

    setIsUnarchiving(true);
    setArchiveStatus("Restoring archive...");

    const response = await fetch(`/api/sessions/${session.id}/archive`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archivedAt: lastArchive.archivedAt }),
    });
    const payload = await response.json().catch(() => ({}));

    setIsUnarchiving(false);

    if (!response.ok) {
      setArchiveStatus(payload.error ?? "Could not restore this archive.");
      return;
    }

    const archive = payload.archive as ArchiveSummary | undefined;
    const restoredSubmissions = archive?.submissions ?? 0;
    const restoredQuestions = archive?.groupQuestions ?? 0;

    setStats(payload.stats ?? stats);
    setLastArchive(null);
    setQuestionsPanelKey((currentKey) => currentKey + 1);
    setArchiveStatus(
      `Restored ${restoredSubmissions} response${restoredSubmissions === 1 ? "" : "s"} and ${restoredQuestions} question${restoredQuestions === 1 ? "" : "s"}.`,
    );
    await refresh();
  }

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refresh();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
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
  const selectedPromptHistory = promptHistory.find(
    (item) => item.id === selectedPromptHistoryId,
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
  const studentUrl = spaceCode
    ? `/spaces/${spaceCode}/${session.code}`
    : `/spaces/${session.code}`;
  const dashboardUrl = spaceCode
    ? `/host/${spaceCode}/${session.code}`
    : `/host/${session.code}`;
  const qrPopoutUrl = `${dashboardUrl}/qr`;

  function buildViewSearch(showHiddenSubmissions = includeHidden) {
    const search = new URLSearchParams({
      includeHidden: String(showHiddenSubmissions),
      minutes: String(minutes),
      starredOnly: String(starredOnly),
    });

    if (selectedPromptHistoryId) {
      search.set("promptHistoryId", selectedPromptHistoryId);
    }

    return search;
  }

  const resultsSearch = buildViewSearch();
  resultsSearch.set("chartType", chartType);
  const resultsUrl = `${dashboardUrl}/results?${resultsSearch.toString()}`;
  const submissionsPopoutSearch = buildViewSearch(false);
  submissionsPopoutSearch.set("sortOrder", submissionSortOrder);
  const submissionsPopoutUrl = `${dashboardUrl}/submissions?${submissionsPopoutSearch.toString()}`;

  function openSubmissionsPopout(url: string) {
    const popoutWindow = window.open(url, "edie-submissions-popout");

    if (!popoutWindow) {
      return false;
    }

    submissionsPopoutWindowRef.current = popoutWindow;
    popoutWindow.focus();
    return true;
  }

  function popOutSubmissions() {
    if (openSubmissionsPopout(submissionsPopoutUrl)) {
      setSubmissionsPopoutOpen(true);
    }
  }

  async function toggleHiddenSubmissions() {
    const opKey = "toggle-hidden-submissions";

    if (isPending(opKey)) {
      return;
    }

    beginOp(opKey);
    const nextIncludeHidden = !includeHidden;
    setIncludeHidden(nextIncludeHidden);

    try {
      await refresh({ includeHidden: nextIncludeHidden });
    } finally {
      endOp(opKey);
    }
  }

  useEffect(() => {
    if (!submissionsPopoutOpen) {
      return;
    }

    const popoutWindow = submissionsPopoutWindowRef.current;

    if (!popoutWindow || popoutWindow.closed) {
      submissionsPopoutWindowRef.current = null;
      setSubmissionsPopoutOpen(false);
      return;
    }

    popoutWindow.location.href = submissionsPopoutUrl;
  }, [submissionsPopoutOpen, submissionsPopoutUrl]);

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <div className="mx-auto w-full max-w-7xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 pr-14 text-sm font-semibold text-slate-500 sm:pr-0">
          <Link className="hover:text-teal-800" href="/host">
            Your spaces
          </Link>
          {spaceCode ? (
            <>
              <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
              </svg>
              <Link className="hover:text-teal-800" href={`/host/${spaceCode}`}>
                {spaceName ?? spaceCode}
              </Link>
            </>
          ) : null}
          <svg aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
          </svg>
          <span className="text-slate-700">{sessionDetails.title}</span>
        </nav>

        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
                Host view
              </p>
              <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
                {sessionDetails.title}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                aria-checked={sessionDetails.isOpen}
                className="inline-flex h-10 items-center gap-2.5 rounded-full border border-slate-300 bg-white pl-3 pr-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-60"
                disabled={isUpdatingSessionAccess}
                role="switch"
                title={sessionDetails.isOpen ? "Close session" : "Open session"}
                type="button"
                onClick={() => {
                  void setSessionOpen(!sessionDetails.isOpen);
                }}
              >
                <span>Accepting responses</span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-10 items-center rounded-full p-1 transition ${
                    sessionDetails.isOpen ? "bg-teal-600" : "bg-slate-300"
                  }`}
                >
                  <span
                    className={`block size-4 rounded-full bg-white shadow-sm transition ${
                      sessionDetails.isOpen ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                href={studentUrl}
              >
                Open student page
              </Link>
              <Link
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                href={qrPopoutUrl}
                rel="noreferrer"
                target="_blank"
              >
                QR popout
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
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
              <PendingActionButton
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!selectedQuestion}
                pending={isPending("delete-question")}
                onClick={() => {
                  void deleteSelectedQuestionFromBank();
                }}
              >
                Delete
              </PendingActionButton>
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
                <PendingActionButton
                  className="h-9 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={promptDraft.trim() === sessionDetails.prompt}
                  pending={isPending("save-prompt")}
                  pendingChildren="Saving..."
                  onClick={savePrompt}
                >
                  Show
                </PendingActionButton>
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
              <PendingActionButton
                className="h-10 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                pending={isPending("timer-start")}
                pendingChildren="Starting..."
                onClick={() => {
                  void startTimer();
                }}
              >
                Start
              </PendingActionButton>
              <PendingActionButton
                className="h-10 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 transition hover:border-red-300 hover:text-red-700"
                pending={isPending("timer-clear")}
                pendingChildren="Clearing..."
                onClick={() => {
                  void clearTimer();
                }}
              >
                Clear
              </PendingActionButton>
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
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="text-sm text-slate-500">
                {isLoading ? "Loading..." : `${displayedSubmissions.length} shown`}
              </p>
              {refreshError ? (
                <p className="text-sm font-medium text-red-700" role="status">
                  {refreshError}
                </p>
              ) : null}
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={() => setShowResultsChart((isShown) => !isShown)}
              >
                {showResultsChart ? "Hide results" : "Visualise results"}
              </button>
              <HostPollManager
                dashboardUrl={dashboardUrl}
                sessionIsOpen={sessionDetails.isOpen}
                sessionCode={session.id}
              />
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={popOutSubmissions}
              >
                Pop out submissions
              </button>
            </div>
          </div>

          <section className="mb-4 rounded-md border border-slate-200 bg-white shadow-sm">
            <button
              aria-controls="teacher-room-controls"
              aria-expanded={showLiveControls}
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
              type="button"
              onClick={() => setShowLiveControls((isShown) => !isShown)}
            >
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Room controls
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {refreshStatus(lastRefresh)}
                </p>
              </div>
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                {showLiveControls ? "Hide" : "Show"}
                <svg
                  aria-hidden="true"
                  className={`size-4 transition ${
                    showLiveControls ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
            </button>
            {showLiveControls ? (
              <div className="border-t border-slate-200" id="teacher-room-controls">
                <div className="grid divide-y divide-slate-200 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
                  <section className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Display &amp; filters</h3>
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800" role="status">
                        {displayedSubmissions.length} shown
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-slate-700" htmlFor="prompt-history-filter">
                        Prompt
                        <select className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" id="prompt-history-filter" value={selectedPromptHistoryId} onChange={(event) => { setSelectedPromptHistoryId(event.target.value); setOrderedSubmissionIds([]); }}>
                          <option value="">All prompts</option>
                          {promptHistory.map((item) => <option key={item.id} value={item.id}>{promptHistoryOptionLabel(item)}</option>)}
                        </select>
                      </label>
                      <div className="flex items-end gap-2">
                        <label className="min-w-0 flex-1 text-sm font-medium text-slate-700" htmlFor="minutes">
                          Time range
                          <select className="mt-1.5 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100" id="minutes" value={minutes} onChange={(event) => setMinutes(Number(event.target.value))}>
                            <option value={1}>Last minute</option>
                            <option value={3}>Last 3 minutes</option>
                            <option value={5}>Last 5 minutes</option>
                            <option value={10}>Last 10 minutes</option>
                            <option value={0}>All time</option>
                          </select>
                        </label>
                        <button aria-label="Refresh responses" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-teal-500 hover:text-teal-800" type="button" onClick={() => void refresh()}>
                          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></svg>
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Card order</p>
                        <div aria-label="Card order" className="mt-1.5 grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1">
                          {submissionSortOptions.map((option) => <button className={`h-8 rounded px-2 text-sm font-semibold transition ${submissionSortOrder === option.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-teal-800"}`} key={option.value} type="button" onClick={() => changeSubmissionSortOrder(option.value)}>{option.label}</button>)}
                        </div>
                      </div>
                      <button aria-pressed={starredOnly} className={`inline-flex h-9 items-center rounded-full border px-3 text-sm font-semibold transition ${starredOnly ? "border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-50" : "border-slate-300 bg-white text-slate-700 hover:border-amber-300 hover:text-amber-900"}`} type="button" onClick={() => setStarredOnly((isStarredOnly) => !isStarredOnly)}>
                        {starredOnly ? "Starred only" : "Show starred only"}
                      </button>
                    </div>
                    {selectedPromptHistory ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500"><InlineCodeText>{selectedPromptHistory.prompt}</InlineCodeText></p> : null}
                  </section>

                  <section className="p-4">
                    <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Moderation &amp; screening</h3>
                    <div className="mt-3 divide-y divide-slate-200">
                  <button
                    aria-checked={sessionDetails.groupQuestionsScreeningEnabled}
                    className="grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
                    disabled={isPending("screen-group-questions")}
                    role="switch"
                    type="button"
                    onClick={() => {
                      void setGroupQuestionsScreeningMode(
                        !sessionDetails.groupQuestionsScreeningEnabled,
                      );
                    }}
                  >
                    <span className="leading-5">Screen group questions</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                        sessionDetails.groupQuestionsScreeningEnabled ? "bg-teal-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-white shadow-sm transition ${
                          sessionDetails.groupQuestionsScreeningEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    aria-checked={sessionDetails.submissionsScreeningEnabled}
                    className="grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
                    disabled={isPending("screen-submissions")}
                    role="switch"
                    type="button"
                    onClick={() => {
                      void setSubmissionsScreeningMode(
                        !sessionDetails.submissionsScreeningEnabled,
                      );
                    }}
                  >
                    <span className="leading-5">Screen submissions</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                        sessionDetails.submissionsScreeningEnabled ? "bg-teal-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-white shadow-sm transition ${
                          sessionDetails.submissionsScreeningEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                  <button
                    aria-checked={includeHidden}
                    className="grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
                    disabled={isPending("toggle-hidden-submissions")}
                    role="switch"
                    type="button"
                    onClick={() => {
                      void toggleHiddenSubmissions();
                    }}
                  >
                    <span className="leading-5">Show hidden submissions</span>
                    <span
                      aria-hidden="true"
                      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${
                        includeHidden ? "bg-teal-600" : "bg-slate-300"
                      }`}
                    >
                      <span
                        className={`block size-5 rounded-full bg-white shadow-sm transition ${
                          includeHidden ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </span>
                  </button>
                    </div>
                  </section>

                  <section className="p-4">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Participant inputs</h3>
                  <div className="mt-3 divide-y divide-slate-200">
                  {([
                    ["textInputEnabled", "Text responses"],
                    ["gifInputEnabled", "GIF responses"],
                    ["drawingInputEnabled", "Drawings"],
                    ["imageInputEnabled", "Image uploads"],
                  ] as const).map(([input, label]) => {
                    const isEnabled = sessionDetails[input];
                    return (
                      <button
                        aria-checked={isEnabled}
                        className="grid min-h-12 w-full grid-cols-[1fr_auto] items-center gap-3 py-2 text-left text-sm font-semibold text-slate-700 transition hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
                        disabled={isPending(`input-${input}`)}
                        key={input}
                        role="switch"
                        type="button"
                        onClick={() => void setSubmissionInputEnabled(input, !isEnabled)}
                      >
                        <span className="leading-5">{label}</span>
                        <span aria-hidden="true" className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${isEnabled ? "bg-teal-600" : "bg-slate-300"}`}>
                          <span className={`block size-5 rounded-full bg-white shadow-sm transition ${isEnabled ? "translate-x-5" : "translate-x-0"}`} />
                        </span>
                      </button>
                    );
                  })}
                  </div>
                  {inputSettingsStatus ? <p className="mt-2 text-xs text-slate-600" role="status">{inputSettingsStatus}</p> : null}
                  </section>
                </div>
                <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Data actions</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800" download href={`/api/sessions/${session.id}/export`}>Export CSV</a>
                    <button className="h-10 rounded-md border border-red-300 bg-white px-3 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60" disabled={isArchiving || isUnarchiving} type="button" onClick={() => { void archiveRoom(); }}>
                      {isArchiving ? "Archiving..." : "Clear / archive room"}
                    </button>
                  </div>
                </footer>
              </div>
            ) : null}
            {showLiveControls && archiveStatus ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
                <p className="text-sm font-medium text-slate-600">
                  {archiveStatus}
                </p>
                {lastArchive ? (
                  <button
                    className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isArchiving || isUnarchiving}
                    type="button"
                    onClick={() => {
                      void unarchiveRoom();
                    }}
                  >
                    {isUnarchiving ? "Restoring..." : "Undo archive"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          <div className="mb-4">
            <GroupQuestionsPanel
              canVote={sessionDetails.isOpen}
              key={questionsPanelKey}
              sessionCode={session.id}
              variant="teacher"
            />
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
                promptUpdatedAt={
                  selectedPromptHistory?.startedAt ?? sessionDetails.promptUpdatedAt
                }
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
                      <PendingActionButton
                        aria-label={
                          submission.starred ? "Remove star from response" : "Star response"
                        }
                        className={`flex size-8 items-center justify-center rounded-md border transition ${
                          submission.starred
                            ? "border-amber-300 bg-amber-100 text-amber-900"
                            : "border-slate-200 text-slate-600 hover:border-amber-300"
                        }`}
                        pending={isPending(`submission:${submission.id}:star`)}
                        pendingChildren={null}
                        title={submission.starred ? "Remove star" : "Star"}
                        onClick={() => void toggleSubmissionStar(submission)}
                      >
                        <StarIcon isActive={submission.starred} />
                      </PendingActionButton>
                      <PendingActionButton
                        aria-label={
                          submission.flagged ? "Remove flag from response" : "Flag response"
                        }
                        className={`flex size-8 items-center justify-center rounded-md border transition ${
                          submission.flagged
                            ? "border-red-300 bg-red-100 text-red-900"
                            : "border-slate-200 text-slate-600 hover:border-red-300"
                        }`}
                        pending={isPending(`submission:${submission.id}:flag`)}
                        pendingChildren={null}
                        title={submission.flagged ? "Remove flag" : "Flag"}
                        onClick={() => void toggleSubmissionFlag(submission)}
                      >
                        <FlagIcon isActive={submission.flagged} />
                      </PendingActionButton>
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
                      <p className="whitespace-pre-wrap">
                        <InlineCodeText>{submission.text}</InlineCodeText>
                      </p>
                    </div>
                  ) : !submission.drawingData && !submission.gifData && !submission.image ? (
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
                  {submission.image ? (
                    <SubmissionImagePreview
                      key={submission.image.url}
                      url={submission.image.url}
                    />
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2" data-no-card-drag="true">
                    <button
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                      type="button"
                      onClick={() => startEditingSubmission(submission)}
                    >
                      Edit
                    </button>
                    <PendingActionButton
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                      pending={isPending(`submission:${submission.id}:status`)}
                      pendingChildren="Working..."
                      onClick={() => void toggleSubmissionVisibility(submission)}
                    >
                      {submission.status === "hidden" ? "Show response" : "Hide response"}
                    </PendingActionButton>
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
