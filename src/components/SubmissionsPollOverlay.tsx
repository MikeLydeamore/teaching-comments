"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PollResultOption } from "./PollResultOption";
import { SessionTimer } from "./SessionTimer";
import { SubmissionMarkdown } from "./SubmissionMarkdown";
import type { PollResults, SessionPoll } from "../lib/edie-store";
import { pollVotingHasEnded } from "../lib/poll-state";

type SubmissionsPollOverlayProps = {
  initialPoll: SessionPoll | null;
  initialResults: PollResults | null;
  sessionCode: string;
};

const activePollRefreshIntervalMs = 2_000;
const idlePollRefreshIntervalMs = 3_000;

export function submissionsPollIsVisible(poll: SessionPoll | null) {
  return poll?.status === "active";
}

export function SubmissionsPollOverlay({
  initialPoll,
  initialResults,
  sessionCode,
}: SubmissionsPollOverlayProps) {
  const [poll, setPoll] = useState(initialPoll);
  const [results, setResults] = useState(initialResults);
  const [nowMs, setNowMs] = useState(0);
  const pollIsActive = submissionsPollIsVisible(poll);

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
    const firstRefresh = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(
      () => {
        if (document.visibilityState === "visible") {
          void refresh();
        }
      },
      pollIsActive
        ? activePollRefreshIntervalMs
        : idlePollRefreshIntervalMs,
    );
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearTimeout(firstRefresh);
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pollIsActive, refresh]);

  useEffect(() => {
    if (!pollIsActive) {
      return;
    }

    const updateNow = () => setNowMs(Date.now());
    const firstUpdate = window.setTimeout(updateNow, 0);
    const timer = window.setInterval(updateNow, 250);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(firstUpdate);
      window.clearInterval(timer);
      document.body.style.overflow = previousOverflow;
    };
  }, [pollIsActive, poll?.endsAt]);

  const maxResultCount = useMemo(
    () =>
      Math.max(
        1,
        ...(results?.options.map((option) => option.responseCount) ?? []),
      ),
    [results],
  );

  if (!pollIsActive || !poll || !results || results.poll.id !== poll.id) {
    return null;
  }

  const solutionIsVisible =
    poll.solutionRevealed || pollVotingHasEnded(poll, nowMs);

  return (
    <div
      aria-labelledby="submissions-poll-question"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-4 text-slate-950 sm:p-6"
      role="dialog"
    >
      <section className="my-auto max-h-[calc(100vh-2rem)] w-full max-w-7xl overflow-y-auto rounded-md border border-slate-200 bg-white p-5 shadow-2xl sm:max-h-[calc(100vh-3rem)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-5 border-b border-slate-300 pb-5">
          <p className="text-xl font-semibold uppercase tracking-[0.14em] text-teal-700">
            {solutionIsVisible ? "Poll results" : "Live poll"}
          </p>
          <SessionTimer
            isEnded={pollVotingHasEnded(poll, nowMs)}
            timerEndsAt={poll.endsAt}
          />
        </div>

        <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
          <div
            aria-level={2}
            className="max-w-5xl text-2xl font-semibold leading-8"
            id="submissions-poll-question"
            role="heading"
          >
            <SubmissionMarkdown>{poll.question}</SubmissionMarkdown>
          </div>
          <p className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold tabular-nums text-slate-700">
            {results.responseCount} response
            {results.responseCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="mt-10 space-y-7" aria-live="polite">
          {results.options.map((option) => (
            <PollResultOption
              animate
              isCorrect={
                solutionIsVisible && poll.correctOptionIds.includes(option.id)
              }
              key={option.id}
              label={option.label}
              maxResponseCount={maxResultCount}
              responseCount={option.responseCount}
              size="overlay"
            />
          ))}
        </div>
      </section>
    </div>
  );
}
