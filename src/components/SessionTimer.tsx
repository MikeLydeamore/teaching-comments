"use client";

import { useEffect, useState } from "react";

type SessionTimerProps = {
  idleText?: string;
  timerEndsAt: string | null;
  variant?: "compact" | "student";
};

export function formatTimerSeconds(totalSeconds: number) {
  const boundedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(boundedSeconds / 60);
  const seconds = boundedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getTimerRemainingSeconds(timerEndsAt: string | null, nowMs: number) {
  if (!timerEndsAt || nowMs <= 0) {
    return null;
  }

  const endMs = new Date(timerEndsAt).getTime();

  if (!Number.isFinite(endMs)) {
    return null;
  }

  return Math.max(0, (endMs - nowMs) / 1000);
}

export function SessionTimer({
  idleText = "No timer running",
  timerEndsAt,
  variant = "compact",
}: SessionTimerProps) {
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, [timerEndsAt]);

  const remainingSeconds = getTimerRemainingSeconds(timerEndsAt, nowMs);
  const hasTimer = remainingSeconds !== null;
  const isRunning = hasTimer && remainingSeconds > 0;
  const status = isRunning ? "Time remaining" : hasTimer ? "Timer ended" : idleText;
  const time = hasTimer ? formatTimerSeconds(remainingSeconds) : "--:--";

  return (
    <div
      className={`rounded-md border ${
        isRunning
          ? "border-teal-200 bg-teal-50 text-teal-950"
          : hasTimer
            ? "border-amber-200 bg-amber-50 text-amber-950"
            : "border-slate-200 bg-slate-50 text-slate-600"
      } ${variant === "student" ? "px-3 py-2" : "px-3 py-2"}`}
    >
      <p className={`${variant === "student" ? "text-xs" : "text-xs"} font-semibold uppercase tracking-[0.12em]`}>
        {status}
      </p>
      <p className={`${variant === "student" ? "text-2xl" : "text-xl"} font-semibold tabular-nums`}>
        {time}
      </p>
    </div>
  );
}
