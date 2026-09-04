"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { DrawingPreview } from "@/components/DrawingPreview";
import { GifPreview } from "@/components/GifPreview";
import { InlineCodeText } from "@/components/InlineCodeText";
import { QrCode } from "@/components/QrCode";
import { SubmissionImagePreview } from "@/components/SubmissionImagePreview";
import type {
  SubmissionDto,
  SubmissionViewSettings,
} from "@/lib/edie-store";
import { submissionTimeRangeLabel } from "@/lib/submission-time-range";

type SubmissionsPopoutProps = {
  dashboardUrl: string;
  initialView: SubmissionView;
  sessionCode: string;
  sessionTitle: string;
  studentUrl: string;
};

type SubmissionView = {
  promptOptions: Array<{ id: string; prompt: string }>;
  promptText: string;
  submissions: SubmissionDto[];
  viewSettings: SubmissionViewSettings;
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
  initialView,
  sessionCode,
  sessionTitle,
  studentUrl,
}: SubmissionsPopoutProps) {
  const [view, setView] = useState(initialView);
  const hasHydrated = useHasHydrated();
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [settingsError, setSettingsError] = useState("");
  const [showStudentQr, setShowStudentQr] = useState(false);
  const [studentShareUrl, setStudentShareUrl] = useState("");
  const savingSettingsRef = useRef(false);
  const { promptOptions, promptText, submissions, viewSettings } = view;
  const { minutes, promptHistoryId, starredOnly } = viewSettings;

  const refresh = useCallback(async (signal: AbortSignal) => {
    const response = await fetch(
      `/api/sessions/${sessionCode}/submission-view`,
      { cache: "no-store", signal },
    );

    if (!response.ok) {
      return;
    }

    const payload = (await response.json().catch(() => null)) as
      | SubmissionView
      | null;

    if (!payload || savingSettingsRef.current) {
      return;
    }

    setView((currentView) =>
      payload.viewSettings.revision < currentView.viewSettings.revision
        ? currentView
        : payload,
    );
    setSettingsError("");
    setLastRefresh(new Date());
  }, [sessionCode]);

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

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh(controller.signal).catch(() => {});
      }
    };

    timer = window.setTimeout(() => void poll(), 3000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      controller.abort();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  async function selectPrompt(nextPromptHistoryId: string) {
    if (savingSettingsRef.current) return;
    savingSettingsRef.current = true;
    setSettingsError("");

    try {
      const response = await fetch(
        `/api/sessions/${sessionCode}/submission-view`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            promptHistoryId: nextPromptHistoryId || null,
          }),
        },
      );
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setSettingsError(payload.error ?? "Could not change the prompt filter.");
        return;
      }

      setView((currentView) => ({
        ...currentView,
        viewSettings: payload.viewSettings,
      }));
    } catch {
      setSettingsError("Could not change the prompt filter.");
    } finally {
      savingSettingsRef.current = false;
    }

    const controller = new AbortController();
    await refresh(controller.signal).catch(() => {});
  }

  function toggleStudentQr() {
    setStudentShareUrl((currentUrl) =>
      currentUrl || new URL(studentUrl, window.location.origin).toString(),
    );
    setShowStudentQr((isShown) => !isShown);
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
            <div className="relative">
              <button
                aria-controls="student-qr-code"
                aria-expanded={showStudentQr}
                className="rounded-md border border-slate-300 px-4 py-3 text-base font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={toggleStudentQr}
              >
                {showStudentQr ? "Hide QR code" : "Show QR code"}
              </button>
              {showStudentQr ? (
                <section
                  className="absolute right-0 top-full z-20 mt-3 aspect-square w-[22.5rem] max-w-[calc(100vw-3rem)] rounded-md border border-slate-200 bg-white p-3 shadow-xl"
                  id="student-qr-code"
                >
                  <QrCode className="size-full" value={studentShareUrl} />
                </section>
              ) : null}
            </div>
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
                  onClick={() => void selectPrompt("")}
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
                    onClick={() => void selectPrompt(prompt.id)}
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
            {starredOnly ? ", starred responses only" : ""}
          </span>
          <span aria-hidden="true">•</span>
          <span>
            {lastRefresh
              ? `Updated ${lastRefresh.toLocaleTimeString()}`
              : "Loaded with page"}
          </span>
        </div>
        {settingsError ? (
          <p className="mt-3 text-sm font-medium text-red-700" role="status">
            {settingsError}
          </p>
        ) : null}
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
