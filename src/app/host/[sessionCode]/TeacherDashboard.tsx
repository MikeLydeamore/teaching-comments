"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import { ConnectedParticipantBadge } from "@/components/ConnectedParticipantBadge";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import { GuidedTour, type GuidedTourStep } from "@/components/GuidedTour";
import { GroupQuestionsPanel } from "@/components/GroupQuestionsPanel";
import { HostGettingStarted } from "@/components/HostGettingStarted";
import { HostPollManager } from "@/components/HostPollManager";
import { InlineCodeText } from "@/components/InlineCodeText";
import { PendingActionButton } from "@/components/PendingActionButton";
import { ToastProvider, useToast } from "@/components/Toast";
import { ResponseTimePlot } from "@/components/ResponseTimePlot";
import { ResultsChart, type ChartType } from "@/components/ResultsChart";
import { SessionTimer } from "@/components/SessionTimer";
import { SubmissionImagePreview } from "@/components/SubmissionImagePreview";
import { SubmissionMarkdown } from "@/components/SubmissionMarkdown";
import { SubmissionMarkdownEditor } from "@/components/SubmissionMarkdownEditor";
import { TimerDurationInput } from "@/components/TimerDurationInput";
import { responseCounts, responseWordCounts } from "@/lib/poll-results";
import { comparePromptRevisions } from "@/lib/prompt-sync";
import { formatTimeAgo } from "@/lib/relative-time";
import {
  getHostOnboardingSnapshot,
  HOST_ONBOARDING_EVENT,
  hostOnboardingServerSnapshot,
  parseHostOnboardingState,
  subscribeToHostOnboarding,
  writeHostOnboardingState,
} from "@/lib/host-onboarding";
import {
  clampTimerSeconds,
  formatTimerSeconds,
  parseTimerDurationInput,
  QUICK_TIMER_ADJUSTMENTS,
  SESSION_TIMER_MIN_SECONDS,
} from "@/lib/timer-duration";
import type {
  DrawingData,
  GifData,
  SubmissionImageDto,
  PromptHistoryItem,
  QuestionBankItem,
  SubmissionViewMinutes,
  SubmissionViewSettings,
  SubmissionViewSettingsPatch,
} from "@/lib/edie-store";
import { runViewTransition } from "@/lib/view-transition";
import { useSubmissionViewRealtime } from "@/lib/use-submission-view-realtime";

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
  imageEmbedsEnabled: boolean;
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
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type Stats = {
  total: number;
  visible: number;
  hidden: number;
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
  initialSubmissionViewSettings: SubmissionViewSettings;
  onboardingScope: string;
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

const roomControlsOpenTourStep = 6;
const roomControlsFirstDetailTourStep = 7;
const roomControlsCloseTourStep = 9;

const dashboardTourSteps: GuidedTourStep[] = [
  {
    description:
      "This is the live control room for one teaching activity. Participants see the prompt and the inputs you choose; you see their responses here as they arrive.",
    target: '[data-tour="dashboard-header"]',
    title: "Your session dashboard",
  },
  {
    description:
      "Write the question you want participants to answer, then select Show. Add questions to the bank when you expect to reuse them.",
    target: '[data-tour="prompt"]',
    title: "Show a prompt",
  },
  {
    description:
      "Turn Accepting responses on when the room is ready. Turn it off at the end to prevent new responses while keeping the activity available to you.",
    target: '[data-tour="session-access"]',
    title: "Open participant access",
  },
  {
    description:
      "Open the QR code on your classroom display. Participants can also use the student page with the space and session codes; they do not need an account.",
    target: '[data-tour="qr-popout"]',
    title: "Invite the room",
  },
  {
    description:
      "Text, drawings, GIFs, and images arrive in the live stream. You can expand, copy, edit, hide, and reorder response cards.",
    target: '[data-tour="response-stream"]',
    title: "Watch responses arrive",
  },
  {
    description:
      "Visualise the current response view, run a live poll, or pop submissions into a presentation-friendly window.",
    target: '[data-tour="live-tools"]',
    title: "Use live activities",
  },
  {
    description:
      "Room controls contain filters, screening, participant input choices, CSV export, and archiving. Select the highlighted Room controls tab to open them.",
    interactiveTarget: true,
    target: '[data-tour="room-controls"]',
    targetActionLabel: "Select Room controls to continue",
    title: "Control what the room sees",
  },
  {
    description:
      "Filter the live stream by prompt or time range, switch the card order, and refresh the current response view. These display choices are shared with presentation popouts.",
    target: '[data-tour="room-controls-display"]',
    title: "Focus the response view",
  },
  {
    description:
      "Screen questions or submissions before showing them, and choose which response formats participants may use. Data export and archiving are available at the bottom of the drawer.",
    target: '[data-tour="room-controls-moderation"]',
    title: "Moderate and shape participation",
  },
  {
    description:
      "Use either highlighted control—the X in the drawer or the Room controls slider—to put the drawer away and return to the dashboard.",
    interactiveTarget: true,
    targets: [
      '[data-tour="room-controls-close"]',
      '[data-tour="room-controls"]',
    ],
    targetActionLabel: "Close Room controls to continue",
    title: "Return to the live dashboard",
  },
  {
    description:
      "When the activity ends, stop accepting responses. You can export a CSV, then clear and archive the room before the next activity. This tour is always available from your account menu.",
    title: "You are ready to teach",
  },
];

const pollTourOpenStep = 0;
const pollTourCloseStep = 5;

const pollTourSteps: GuidedTourStep[] = [
  {
    description:
      "Polls live with the other presentation tools above the response stream. Select the highlighted Run poll button to open the poll builder.",
    interactiveTarget: true,
    target: '[data-tour="poll-launch"]',
    targetActionLabel: "Select Run poll to continue",
    title: "Open polling mode",
  },
  {
    description:
      "Write your question, then choose whether participants may select one answer or several. You can also load a poll you have saved in the question bank.",
    targets: ['#poll-question', '[data-tour="poll-answer-type"]'],
    title: "Ask the question",
  },
  {
    description:
      "Add between two and eight answers. Mark the correct answer—or answers—so Ed.ie can reveal the solution after voting finishes.",
    targets: [
      '[data-tour="poll-answers-heading"]',
      '[data-tour="poll-answers"]',
    ],
    title: "Set the possible answers",
  },
  {
    description:
      "Choose how long voting should stay open. You can type a duration or use the quick adjustments to add or remove time.",
    target: '[data-tour="poll-timer"]',
    title: "Set the timer",
  },
  {
    description:
      "Start poll sends the question to participants immediately. This guide highlights the button without selecting it, so no practice poll is launched.",
    target: '[data-tour="poll-start"]',
    title: "Start voting",
  },
  {
    description:
      "While a poll is live, this window shows responses and lets you extend or end voting, reveal the solution, and pop out the results. Select Close to return to the dashboard.",
    interactiveTarget: true,
    target: '[data-tour="poll-close"]',
    targetActionLabel: "Select Close to continue",
    title: "Manage the live poll",
  },
  {
    description:
      "That is the full flow: open polling mode, prepare the question and answers, set the timer, and start. You can replay this guide at any time from Help.",
    title: "You are ready to run a poll",
  },
];

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

function questionBankTextKey(text: string) {
  return text.trim().toLowerCase();
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

const sessionStateRefreshIntervalMs = 20_000;
const questionBankRefreshIntervalMs = 10_000;

type DashboardRefreshScope = "all" | "session" | "submissions";

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
  initialSubmissionViewSettings,
  onboardingScope,
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
  const [minutes, setMinutes] = useState<SubmissionViewMinutes>(
    initialSubmissionViewSettings.minutes,
  );
  const [promptHistory, setPromptHistory] = useState(initialPromptHistory);
  const [selectedPromptHistoryId, setSelectedPromptHistoryId] = useState(
    initialSubmissionViewSettings.promptHistoryId ?? "",
  );
  const [submissionSortOrder, setSubmissionSortOrder] =
    useState<SubmissionSortOrder>(initialSubmissionViewSettings.sortOrder);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(
    initialSubmissionViewSettings.expandedSubmissionId,
  );
  const expandedSubmissionIdRef = useRef(
    initialSubmissionViewSettings.expandedSubmissionId,
  );
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [orderedSubmissionIds, setOrderedSubmissionIds] = useState<string[]>([]);
  const [draggedSubmissionId, setDraggedSubmissionId] = useState<string | null>(null);
  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshError, setRefreshError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [isRoomControlsOpen, setIsRoomControlsOpen] = useState(false);
  const [showResultsChart, setShowResultsChart] = useState(false);
  const [chartType, setChartType] = useState<ChartType>("column");
  const [timerDraftSeconds, setTimerDraftSeconds] = useState(30);
  const [timerDraftValue, setTimerDraftValue] = useState(formatTimerSeconds(30));
  const [timerDraftWasMinClamped, setTimerDraftWasMinClamped] = useState(false);
  const [timerStatus, setTimerStatus] = useState("");
  const [inputSettingsStatus, setInputSettingsStatus] = useState("");
  const [isUpdatingSessionAccess, setIsUpdatingSessionAccess] = useState(false);
  const submissionViewRevisionRef = useRef(
    initialSubmissionViewSettings.revision,
  );
  const submissionViewUpdatePendingRef = useRef(false);
  const questionBankRefreshRequestIdRef = useRef(0);
  const latestPromptUpdatedAtRef = useRef(session.promptUpdatedAt);
  const [isUpdatingSubmissionView, setIsUpdatingSubmissionView] =
    useState(false);
  const [submissionViewStatus, setSubmissionViewStatus] = useState("");
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
  const onboardingSnapshot = useSyncExternalStore(
    (onStoreChange) =>
      subscribeToHostOnboarding(onboardingScope, onStoreChange),
    () => getHostOnboardingSnapshot(onboardingScope),
    () => hostOnboardingServerSnapshot,
  );
  const onboardingState = useMemo(
    () => parseHostOnboardingState(onboardingSnapshot),
    [onboardingSnapshot],
  );
  const [isTourOpen, setIsTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [isPollTourOpen, setIsPollTourOpen] = useState(false);
  const [pollTourStep, setPollTourStep] = useState(0);
  const roomControlsDrawerRef = useRef<HTMLElement>(null);
  const roomControlsTriggerRef = useRef<HTMLButtonElement>(null);
  const roomControlsCloseRef = useRef<HTMLButtonElement>(null);
  const toast = useToast();

  const updateOnboardingState = useCallback(
    (patch: Parameters<typeof writeHostOnboardingState>[1]) => {
      writeHostOnboardingState(onboardingScope, patch);
    },
    [onboardingScope],
  );

  const startDashboardTour = useCallback(() => {
    setIsRoomControlsOpen(false);
    setIsPollTourOpen(false);
    setTourStep(0);
    setIsTourOpen(true);
  }, []);

  const startPollTour = useCallback(() => {
    setIsRoomControlsOpen(false);
    setIsTourOpen(false);
    setPollTourStep(pollTourOpenStep);
    setIsPollTourOpen(true);
  }, []);

  useEffect(() => {
    const openTimer = window.setTimeout(() => {
      if (
        parseHostOnboardingState(getHostOnboardingSnapshot(onboardingScope))
          .sessionTourStatus === "not-started"
      ) {
        startDashboardTour();
      }
    }, 0);

    function restartTour(event: Event) {
      const tour = (event as CustomEvent).detail;

      if (tour === "session") {
        startDashboardTour();
      } else if (tour === "poll") {
        startPollTour();
      }
    }

    window.addEventListener(HOST_ONBOARDING_EVENT, restartTour);
    return () => {
      window.clearTimeout(openTimer);
      window.removeEventListener(HOST_ONBOARDING_EVENT, restartTour);
    };
  }, [onboardingScope, startDashboardTour, startPollTour]);

  function changeTourStep(nextStep: number) {
    const drawerShouldBeOpen =
      nextStep >= roomControlsFirstDetailTourStep &&
      nextStep <= roomControlsCloseTourStep;

    setIsRoomControlsOpen(drawerShouldBeOpen);
    setTourStep(nextStep);
  }

  function changePollTourStep(nextStep: number) {
    setPollTourStep(nextStep);
  }

  const applyExpandedSubmissionId = useCallback((nextId: string | null) => {
    if (expandedSubmissionIdRef.current === nextId) {
      return;
    }

    expandedSubmissionIdRef.current = nextId;
    runViewTransition(() => setExpandedSubmissionId(nextId));
  }, []);

  useEffect(() => {
    if (!isRoomControlsOpen || isTourOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const triggerElement = roomControlsTriggerRef.current;

    if (scrollbarWidth > 0) {
      const bodyPaddingRight = Number.parseFloat(
        window.getComputedStyle(document.body).paddingRight,
      );
      document.body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
    }

    document.body.style.overflow = "hidden";
    roomControlsCloseRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsRoomControlsOpen(false);
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusableElements = Array.from(
        roomControlsDrawerRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      ).filter((element) => !element.hasAttribute("hidden"));

      if (!focusableElements.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [isRoomControlsOpen, isTourOpen]);

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

  const refreshQuestionBank = useCallback(async (reportErrors = false) => {
    const requestId = ++questionBankRefreshRequestIdRef.current;

    try {
      const response = await fetch(`/api/sessions/${session.id}/questions`, {
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));

      if (requestId !== questionBankRefreshRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        if (reportErrors) {
          setQuestionBankStatus(
            payload.error ?? "Could not refresh the question bank.",
          );
        }
        return;
      }

      const nextQuestionBank = sortQuestionBank(payload.questionBank ?? []);
      setQuestionBank(nextQuestionBank);
      setSelectedQuestionId((currentId) =>
        nextQuestionBank.some((question) => question.id === currentId)
          ? currentId
          : "",
      );
    } catch {
      if (
        reportErrors &&
        requestId === questionBankRefreshRequestIdRef.current
      ) {
        setQuestionBankStatus("Could not refresh the question bank.");
      }
    }
  }, [session.id]);

  const applyRefreshedSession = useCallback((nextSession: Session) => {
    const revisionOrder = comparePromptRevisions(
      latestPromptUpdatedAtRef.current,
      nextSession.promptUpdatedAt,
    );

    if (revisionOrder === "older") {
      setSessionDetails((currentSession) => ({
        ...nextSession,
        prompt: currentSession.prompt,
        promptUpdatedAt: currentSession.promptUpdatedAt,
      }));
      return;
    }

    setSessionDetails(nextSession);

    if (revisionOrder === "newer") {
      latestPromptUpdatedAtRef.current = nextSession.promptUpdatedAt;
      setPromptDraft(nextSession.prompt);
      setSelectedQuestionId("");
      setQuestionBankStatus("");
      setPromptStatus("Prompt shown by another host.");
    }
  }, []);

  const refresh = useCallback(async (overrides?: {
    scope?: DashboardRefreshScope;
  }) => {
    const scope = overrides?.scope ?? "all";
    const query = new URLSearchParams({
      includeHidden: "true",
    });

    let submissionsResponse: Response | null;
    let sessionResponse: Response | null;

    try {
      [submissionsResponse, sessionResponse] = await Promise.all([
        scope === "session"
          ? Promise.resolve(null)
          : fetch(`/api/sessions/${session.id}/submission-view?${query}`),
        scope === "submissions"
          ? Promise.resolve(null)
          : fetch(`/api/sessions/${session.id}`),
      ]);
    } catch {
      setRefreshError("Could not refresh the dashboard. Trying again shortly.");
      setIsLoading(false);
      return;
    }

    const [submissionsPayload, sessionPayload] = (await Promise.all([
      submissionsResponse?.json().catch(() => ({})) ?? {},
      sessionResponse?.json().catch(() => ({})) ?? {},
    ])) as [
      {
        error?: string;
        promptHistory?: PromptHistoryItem[];
        submissions?: Submission[];
        viewSettings?: SubmissionViewSettings;
      },
      {
        error?: string;
        promptHistory?: typeof initialPromptHistory;
        session?: typeof session;
        stats?: typeof initialStats;
      },
    ];

    if (
      (submissionsResponse && !submissionsResponse.ok) ||
      (sessionResponse && !sessionResponse.ok)
    ) {
      setRefreshError(
        submissionsPayload.error ??
          sessionPayload.error ??
          "Could not refresh the dashboard. Trying again shortly.",
      );
      setIsLoading(false);
      return;
    }

    if (submissionsResponse) {
      const nextSubmissions = submissionsPayload.submissions ?? [];
      const nextViewSettings = submissionsPayload.viewSettings;

      if (
        nextViewSettings &&
        !submissionViewUpdatePendingRef.current &&
        nextViewSettings.revision >= submissionViewRevisionRef.current
      ) {
        const sortOrderChanged =
          nextViewSettings.sortOrder !== submissionSortOrder;
        submissionViewRevisionRef.current = nextViewSettings.revision;
        setMinutes(nextViewSettings.minutes);
        if (submissionsPayload.promptHistory) {
          setPromptHistory(submissionsPayload.promptHistory);
        }
        setSelectedPromptHistoryId(nextViewSettings.promptHistoryId ?? "");
        applyExpandedSubmissionId(nextViewSettings.expandedSubmissionId);
        setSubmissionSortOrder(nextViewSettings.sortOrder);
        setSubmissions(nextSubmissions);
        setOrderedSubmissionIds((currentOrder) =>
          sortOrderChanged
            ? submissionIdsForOrder(nextSubmissions, nextViewSettings.sortOrder)
            : mergeSubmissionOrder(
                currentOrder,
                nextSubmissions,
                nextViewSettings.sortOrder,
              ),
        );
      }
    }
    if (sessionResponse) {
      if (sessionPayload.session) {
        applyRefreshedSession(sessionPayload.session);
      }
      if (sessionPayload.promptHistory) {
        setPromptHistory(sessionPayload.promptHistory);
      }
      setStats(sessionPayload.stats ?? initialStats);
    }
    setRefreshError("");
    setLastRefresh(new Date());
    setIsLoading(false);
  }, [
    applyExpandedSubmissionId,
    applyRefreshedSession,
    initialStats,
    session.id,
    submissionSortOrder,
  ]);

  const refreshSubmissions = useCallback(
    () => refresh({ scope: "submissions" }),
    [refresh],
  );
  const {
    connectedParticipants,
    status: submissionRealtimeStatus,
  } = useSubmissionViewRealtime({
    refresh: refreshSubmissions,
    sessionCode: session.id,
  });

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

      latestPromptUpdatedAtRef.current = payload.session.promptUpdatedAt;
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
    const promptKey = questionBankTextKey(promptText);

    if (
      questionBank.some(
        (question) => questionBankTextKey(question.text) === promptKey,
      )
    ) {
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

    try {
      const response = await fetch(`/api/sessions/${session.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: promptText, title: questionTitle }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setQuestionBankStatus(payload.error ?? "Could not add question.");
        await refreshQuestionBank();
        return;
      }

      const nextQuestion = payload.question as QuestionBankItem;
      setQuestionBank((currentQuestionBank) =>
        sortQuestionBank([
          ...currentQuestionBank.filter(
            (question) => question.id !== nextQuestion.id,
          ),
          nextQuestion,
        ]),
      );
      setSelectedQuestionId(nextQuestion.id);
      setIsQuestionTitleDialogOpen(false);
      setQuestionTitleDraft("");
      setQuestionBankStatus("Question added to bank.");
      await refreshQuestionBank();
    } catch {
      setQuestionBankStatus("Could not add question.");
    }
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
        await refreshQuestionBank();
        return;
      }

      setQuestionBank((currentQuestionBank) =>
        currentQuestionBank.filter((bankQuestion) => bankQuestion.id !== question.id),
      );
      setSelectedQuestionId("");
      setQuestionBankStatus("Question deleted from bank.");
      await refreshQuestionBank();
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

    const nextSeconds = clampTimerSeconds(parsedSeconds, SESSION_TIMER_MIN_SECONDS);
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
    input: "textInputEnabled" | "gifInputEnabled" | "drawingInputEnabled" | "imageInputEnabled" | "imageEmbedsEnabled",
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
        const message = payload.error ?? "Could not update session access.";
        toast.error(message);
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
    const nextSeconds = clampTimerSeconds(seconds, SESSION_TIMER_MIN_SECONDS);
    setTimerDraftSeconds(nextSeconds);
    setTimerDraftValue(formatTimerSeconds(nextSeconds));
    setTimerDraftWasMinClamped(seconds < SESSION_TIMER_MIN_SECONDS);
    setTimerStatus("");
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

  async function updateSubmissionView(
    patch: SubmissionViewSettingsPatch,
  ) {
    if (submissionViewUpdatePendingRef.current) return;

    submissionViewUpdatePendingRef.current = true;
    setIsUpdatingSubmissionView(true);
    setSubmissionViewStatus("Saving display settings...");

    if ("promptHistoryId" in patch) {
      setSelectedPromptHistoryId(patch.promptHistoryId ?? "");
      setOrderedSubmissionIds([]);
    }
    if (typeof patch.minutes === "number") {
      setMinutes(patch.minutes);
    }
    if (patch.sortOrder) {
      setSubmissionSortOrder(patch.sortOrder);
      setOrderedSubmissionIds(
        submissionIdsForOrder(submissions, patch.sortOrder),
      );
    }
    if ("expandedSubmissionId" in patch) {
      applyExpandedSubmissionId(patch.expandedSubmissionId ?? null);
    }
    try {
      const response = await fetch(
        `/api/sessions/${session.id}/submission-view`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          payload.error ?? "Could not save the display settings.";
        setSubmissionViewStatus(message);
        toast.error(message);
      } else {
        const nextViewSettings = payload.viewSettings as SubmissionViewSettings;
        submissionViewRevisionRef.current = nextViewSettings.revision;
        setMinutes(nextViewSettings.minutes);
        setSelectedPromptHistoryId(nextViewSettings.promptHistoryId ?? "");
        applyExpandedSubmissionId(nextViewSettings.expandedSubmissionId);
        setSubmissionSortOrder(nextViewSettings.sortOrder);
        setSubmissionViewStatus("Display settings synced.");
      }
    } catch {
      const message = "Could not save the display settings.";
      setSubmissionViewStatus(message);
      toast.error(message);
    } finally {
      submissionViewUpdatePendingRef.current = false;
      setIsUpdatingSubmissionView(false);
    }

    await refresh({ scope: "submissions" });
  }

  function changeSubmissionSortOrder(nextSortOrder: SubmissionSortOrder) {
    void updateSubmissionView({ sortOrder: nextSortOrder });
  }

  function toggleExpandedSubmission(submissionId: string) {
    void updateSubmissionView({
      expandedSubmissionId:
        expandedSubmissionId === submissionId ? null : submissionId,
    });
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
    const sessionStateTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh({ scope: "session" });
      }
    }, sessionStateRefreshIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(sessionStateTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    const firstRefresh = window.setTimeout(() => {
      void refreshQuestionBank();
    }, 0);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshQuestionBank();
      }
    }, questionBankRefreshIntervalMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshQuestionBank();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshQuestionBank]);

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
  const displayedSubmissions = orderedSubmissions;
  const chartSubmissions = useMemo(
    () =>
      displayedSubmissions.filter(
        (submission) => submission.status !== "hidden",
      ),
    [displayedSubmissions],
  );
  const wordCounts = useMemo(
    () => responseWordCounts(chartSubmissions, 8),
    [chartSubmissions],
  );
  const maxWordCount = Math.max(1, ...wordCounts.map(([, count]) => count));
  const pollResults = useMemo(
    () => responseCounts(chartSubmissions),
    [chartSubmissions],
  );
  const wordCloudResults = useMemo(
    () => responseWordCounts(chartSubmissions),
    [chartSubmissions],
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
  const promptDraftKey = questionBankTextKey(promptDraftText);
  const promptIsAlreadyInBank = questionBank.some(
    (question) => questionBankTextKey(question.text) === promptDraftKey,
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

  function buildViewSearch() {
    const search = new URLSearchParams({
      includeHidden: "false",
      minutes: String(minutes),
    });

    if (selectedPromptHistoryId) {
      search.set("promptHistoryId", selectedPromptHistoryId);
    }

    return search;
  }

  const resultsSearch = buildViewSearch();
  resultsSearch.set("chartType", chartType);
  const resultsUrl = `${dashboardUrl}/results?${resultsSearch.toString()}`;
  const submissionsPopoutUrl = `${dashboardUrl}/submissions`;
  const roomControlsTourIsClosing =
    isTourOpen && tourStep === roomControlsCloseTourStep;

  function popOutSubmissions() {
    window.open(
      submissionsPopoutUrl,
      "edie-submissions-popout",
    )?.focus();
  }

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

        <header
          className="rounded-md border border-slate-200 bg-white p-6 shadow-sm"
          data-tour="dashboard-header"
        >
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
              <ConnectedParticipantBadge
                connectedParticipants={connectedParticipants}
                status={submissionRealtimeStatus}
              />
              <button
                aria-checked={sessionDetails.isOpen}
                className="inline-flex h-10 items-center gap-2.5 rounded-full border border-slate-300 bg-white pl-3 pr-2 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-60"
                disabled={isUpdatingSessionAccess}
                data-tour="session-access"
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
                data-tour="qr-popout"
                rel="noreferrer"
                target="_blank"
                onClick={() =>
                  updateOnboardingState({ qrOpened: true })
                }
              >
                QR popout
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-5">
          {!onboardingState.checklistDismissed ? (
            <HostGettingStarted
              items={[
                { complete: sessionDetails.prompt.trim().length > 0, label: "Show your first prompt" },
                { complete: sessionDetails.isOpen, label: "Accept participant responses" },
                { complete: onboardingState.qrOpened, label: "Open the QR code" },
                { complete: stats.total > 0, label: "Receive the first response" },
                { complete: onboardingState.roomControlsOpened, label: "Explore Room controls" },
              ]}
              onDismiss={() =>
                updateOnboardingState({ checklistDismissed: true })
              }
              onStartTour={startDashboardTour}
            />
          ) : null}
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
              <TimerDurationInput
                id="timer-duration"
                value={timerDraftValue}
                onValueChange={(value) => {
                  setTimerDraftValue(value);
                  setTimerDraftWasMinClamped(false);
                  setTimerStatus("");
                }}
                onCommit={(parsedSeconds) => {
                  if (parsedSeconds !== null) {
                    setTimerDraftDuration(parsedSeconds);
                  }
                }}
                onSubmit={() => {
                  void startTimer();
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
              {QUICK_TIMER_ADJUSTMENTS.map((seconds) => (
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
            <dl className="mt-3 grid grid-cols-3 gap-3">
              {[
                ["Total", stats.total],
                ["Visible", stats.visible],
                ["Hidden", stats.hidden],
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

        <section data-tour="response-stream">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">
              Live writing stream
            </h2>
            <div
              className="flex flex-wrap items-center justify-end gap-3"
              data-tour="live-tools"
            >
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
                pollTutorial={
                  isPollTourOpen
                    ? {
                        isManagerOpen:
                          pollTourStep > pollTourOpenStep &&
                          pollTourStep <= pollTourCloseStep,
                        onManagerClose: () =>
                          setPollTourStep(pollTourCloseStep + 1),
                        onManagerOpen: () =>
                          setPollTourStep(pollTourOpenStep + 1),
                      }
                    : undefined
                }
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

          <section
            className="mb-4 rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            data-tour="prompt"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Prompt</h3>
              </div>
              <p className="text-xs font-medium text-slate-500">
                {promptDraft.length}/1200
              </p>
            </div>
            <label
              className="mt-5 block text-sm font-medium text-slate-700"
              htmlFor="question-bank"
            >
              Question bank
            </label>
            <div className="mt-2 flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <div className="relative min-w-0 flex-1">
                <select
                  className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white py-0 pl-3 pr-12 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
                  id="question-bank"
                  value={selectedQuestionId}
                  onChange={(event) => selectQuestionFromBank(event.target.value)}
                >
                  <option value="">
                    {questionBank.length
                      ? "Select a saved question"
                      : "No saved questions"}
                  </option>
                  {questionBank.map((question) => (
                    <option key={question.id} value={question.id}>
                      {question.title}
                    </option>
                  ))}
                </select>
                <svg
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </div>
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
            <SubmissionMarkdownEditor
              ariaLabel="Session prompt"
              id="prompt"
              imageEmbedsEnabled={sessionDetails.imageEmbedsEnabled}
              maxLength={1200}
              placeholder="Write the prompt shown to students..."
              value={promptDraft}
              onChange={(nextPromptDraft) => {
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
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canAddPromptToBank}
                type="button"
                onClick={openQuestionTitleDialog}
              >
                Add to bank
              </button>
              <PendingActionButton
                className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={promptDraft.trim() === sessionDetails.prompt}
                pending={isPending("save-prompt")}
                pendingChildren="Saving..."
                onClick={savePrompt}
              >
                Show
              </PendingActionButton>
            </div>
            {questionBankStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {questionBankStatus}
              </p>
            ) : null}
            {promptStatus ? (
              <p className="mt-3 text-sm font-medium text-slate-600">
                {promptStatus}
              </p>
            ) : null}
          </section>

          <button
            aria-controls="teacher-room-controls"
            aria-expanded={isRoomControlsOpen}
            aria-label={
              isRoomControlsOpen ? "Close room controls" : "Open room controls"
            }
            className={`fixed top-1/2 z-[80] flex -translate-y-1/2 items-center gap-2 rounded-l-md border border-r-0 border-slate-300 bg-white px-2 py-3 text-sm font-semibold text-slate-700 shadow-lg transition-[right,opacity,background-color,color] duration-200 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100 motion-reduce:transition-none ${
              isRoomControlsOpen
                ? roomControlsTourIsClosing
                  ? "pointer-events-auto right-0 opacity-100 sm:right-[28rem]"
                  : "pointer-events-none right-0 opacity-0 sm:pointer-events-auto sm:right-[28rem] sm:opacity-100"
                : "right-0"
            }`}
            data-tour="room-controls"
            ref={roomControlsTriggerRef}
            type="button"
            onClick={() => {
              if (!isRoomControlsOpen) {
                updateOnboardingState({ roomControlsOpened: true });
              }
              const nextIsOpen = !isRoomControlsOpen;
              setIsRoomControlsOpen(nextIsOpen);

              if (
                nextIsOpen &&
                isTourOpen &&
                tourStep === roomControlsOpenTourStep
              ) {
                setTourStep(roomControlsFirstDetailTourStep);
              } else if (
                !nextIsOpen &&
                isTourOpen &&
                tourStep === roomControlsCloseTourStep
              ) {
                setTourStep(roomControlsCloseTourStep + 1);
              }
            }}
          >
            <svg
              aria-hidden="true"
              className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${
                isRoomControlsOpen ? "rotate-180" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="[writing-mode:vertical-rl]">Room controls</span>
          </button>

          <div
            aria-hidden="true"
            className={`fixed inset-0 z-[60] bg-slate-950/40 transition-opacity duration-200 motion-reduce:transition-none ${
              isRoomControlsOpen
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsRoomControlsOpen(false);
              }
            }}
          />

          <aside
            aria-hidden={!isRoomControlsOpen}
            aria-labelledby="teacher-room-controls-title"
            aria-modal={isRoomControlsOpen && !isTourOpen ? "true" : undefined}
            className={`fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl transition-transform duration-200 motion-reduce:transition-none ${
              isRoomControlsOpen ? "translate-x-0" : "translate-x-full"
            }`}
            id="teacher-room-controls"
            inert={!isRoomControlsOpen}
            ref={roomControlsDrawerRef}
            role="dialog"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4">
              <div>
                <h2
                  className="text-xl font-semibold text-slate-950"
                  id="teacher-room-controls-title"
                >
                  Room controls
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {refreshStatus(lastRefresh)}
                </p>
              </div>
              <button
                aria-label="Close room controls"
                className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 text-slate-700 transition hover:border-teal-500 hover:text-teal-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-100"
                data-tour="room-controls-close"
                ref={roomControlsCloseRef}
                type="button"
                onClick={() => {
                  setIsRoomControlsOpen(false);

                  if (
                    isTourOpen &&
                    tourStep === roomControlsCloseTourStep
                  ) {
                    setTourStep(roomControlsCloseTourStep + 1);
                  }
                }}
              >
                <svg
                  aria-hidden="true"
                  className="size-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="divide-y divide-slate-200">
                  <section className="p-4" data-tour="room-controls-display">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Display &amp; filters</h3>
                      <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-800" role="status">
                        {displayedSubmissions.length} shown
                      </span>
                    </div>
                    <div className="mt-4 space-y-3">
                      <label className="block text-sm font-medium text-slate-700" htmlFor="prompt-history-filter">
                        Prompt
                        <span className="relative mt-1.5 block">
                          <select
                            className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white py-0 pl-3 pr-12 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-60"
                            disabled={isUpdatingSubmissionView}
                            id="prompt-history-filter"
                            value={selectedPromptHistoryId}
                            onChange={(event) =>
                              void updateSubmissionView({
                                promptHistoryId: event.target.value || null,
                              })
                            }
                          >
                            <option value="">All prompts</option>
                            {promptHistory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {promptHistoryOptionLabel(item)}
                              </option>
                            ))}
                          </select>
                          <svg
                            aria-hidden="true"
                            className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-600"
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
                      </label>
                      <div className="flex items-end gap-2">
                        <label className="min-w-0 flex-1 text-sm font-medium text-slate-700" htmlFor="minutes">
                          Time range
                          <span className="relative mt-1.5 block">
                            <select
                              className="h-10 w-full appearance-none rounded-md border border-slate-300 bg-white py-0 pl-3 pr-12 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100 disabled:cursor-wait disabled:opacity-60"
                              disabled={isUpdatingSubmissionView}
                              id="minutes"
                              value={minutes}
                              onChange={(event) =>
                                void updateSubmissionView({
                                  minutes: Number(
                                    event.target.value,
                                  ) as SubmissionViewMinutes,
                                })
                              }
                            >
                              <option value={1}>Last minute</option>
                              <option value={3}>Last 3 minutes</option>
                              <option value={5}>Last 5 minutes</option>
                              <option value={10}>Last 10 minutes</option>
                              <option value={0}>All time</option>
                            </select>
                            <svg
                              aria-hidden="true"
                              className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-600"
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
                        </label>
                        <button aria-label="Refresh responses" className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-700 transition hover:border-teal-500 hover:text-teal-800" type="button" onClick={() => void refresh()}>
                          <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 5v4h4M4 13a8.1 8.1 0 0 0 15.5 2M20 19v-4h-4" /></svg>
                        </button>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">Card order</p>
                        <div aria-label="Card order" className="mt-1.5 grid grid-cols-2 rounded-md border border-slate-300 bg-slate-50 p-1">
                          {submissionSortOptions.map((option) => <button className={`h-8 rounded px-2 text-sm font-semibold transition disabled:cursor-wait disabled:opacity-60 ${submissionSortOrder === option.value ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-teal-800"}`} disabled={isUpdatingSubmissionView} key={option.value} type="button" onClick={() => changeSubmissionSortOrder(option.value)}>{option.label}</button>)}
                        </div>
                      </div>
                    </div>
                    {submissionViewStatus ? <p className="mt-3 text-xs font-medium text-slate-500" role="status">{submissionViewStatus}</p> : null}
                    {selectedPromptHistory ? <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500"><InlineCodeText>{selectedPromptHistory.prompt}</InlineCodeText></p> : null}
                  </section>

                  <section className="p-4" data-tour="room-controls-moderation">
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
                    ["imageEmbedsEnabled", "Image embeds"],
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
            {archiveStatus ? (
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
            </div>
          </aside>

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
                submissions={chartSubmissions}
              />
            </section>
          ) : null}

          {isTourOpen ? (
            <GuidedTour
              currentStep={tourStep}
              steps={dashboardTourSteps}
              onComplete={() => {
                updateOnboardingState({ sessionTourStatus: "completed" });
                setIsTourOpen(false);
                setIsRoomControlsOpen(false);
              }}
              onStepChange={changeTourStep}
              onSkip={() => {
                updateOnboardingState({ sessionTourStatus: "skipped" });
                setIsTourOpen(false);
                setIsRoomControlsOpen(false);
              }}
            />
          ) : null}

          {isPollTourOpen ? (
            <GuidedTour
              completeLabel="Done"
              currentStep={pollTourStep}
              steps={pollTourSteps}
              tourLabel="Poll guide"
              onComplete={() => setIsPollTourOpen(false)}
              onStepChange={changePollTourStep}
              onSkip={() => setIsPollTourOpen(false)}
            />
          ) : null}

          {displayedSubmissions.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {displayedSubmissions.map((submission) => (
                <div
                  className={`cursor-grab active:cursor-grabbing ${
                    expandedSubmissionId === submission.id
                      ? "md:col-span-2 xl:col-span-3"
                      : ""
                  }`}
                  draggable
                  key={submission.id}
                  style={{ viewTransitionName: `submission-${submission.id}` }}
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
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                        {formatTimeAgo(submission.createdAt)}
                      </p>
                      <button
                        aria-label={`${expandedSubmissionId === submission.id ? "Collapse" : "Expand"} response from ${submission.studentName || "Anonymous"}`}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-white text-xl font-semibold leading-none text-slate-700 transition hover:border-teal-500 hover:text-teal-800 disabled:cursor-wait disabled:opacity-60"
                        data-no-card-drag="true"
                        disabled={isUpdatingSubmissionView}
                        title={expandedSubmissionId === submission.id ? "Collapse response" : "Expand response"}
                        type="button"
                        onClick={() => toggleExpandedSubmission(submission.id)}
                      >
                        <span aria-hidden="true">
                          {expandedSubmissionId === submission.id ? "−" : "+"}
                        </span>
                      </button>
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
                      <SubmissionMarkdown imageEmbedsEnabled={sessionDetails.imageEmbedsEnabled}>
                        {submission.text}
                      </SubmissionMarkdown>
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
                      <GifPreview
                        gifData={submission.gifData}
                        imageClassName={
                          expandedSubmissionId === submission.id
                            ? "max-h-[40rem]"
                            : undefined
                        }
                      />
                    </div>
                  ) : null}
                  {submission.drawingData ? (
                    <div className="cursor-auto" data-no-card-drag="true">
                      <DrawingPreview drawingData={submission.drawingData} />
                    </div>
                  ) : null}
                  {submission.image ? (
                    <SubmissionImagePreview
                      className={
                        expandedSubmissionId === submission.id
                          ? "max-h-[40rem] w-full rounded-md border border-slate-200 object-contain"
                          : undefined
                      }
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
              No submissions in this time window yet.
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
