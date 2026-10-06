"use client";

import Link from "next/link";
import type { SubmissionViewRealtimeStatus } from "@/lib/submission-view-events";

export function ConnectedParticipantBadge({
  connectedParticipants,
  limit = null,
  status,
}: {
  connectedParticipants: number | null;
  limit?: number | null;
  status: SubmissionViewRealtimeStatus;
}) {
  const isValid = status === "live" && connectedParticipants !== null;
  const isReconnecting = status === "reconnecting";
  const isAtCapacity =
    isValid && limit !== null && connectedParticipants >= limit;
  const label = `${isValid ? connectedParticipants : "—"}${
    limit === null ? "" : ` / ${limit}`
  } connected`;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          isAtCapacity
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : isValid
              ? "border-teal-200 bg-teal-50 text-teal-800"
              : isReconnecting
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
        title={
          isAtCapacity
            ? "This session has reached its concurrent participant limit."
            : isValid
              ? "Anonymous browser profiles active on the student form in approximately the last 30 seconds."
              : isReconnecting
                ? "Reconnecting before checking the active student count."
                : "The active student count is temporarily unavailable."
        }
      >
        <span
          aria-hidden="true"
          className={`size-1.5 rounded-full ${
            isAtCapacity
              ? "bg-amber-500"
              : isValid
                ? "bg-teal-600"
                : isReconnecting
                  ? "bg-slate-400"
                  : "bg-amber-500"
          }`}
        />
        {label}
      </span>
      {isAtCapacity ? (
        <Link
          className="text-xs font-semibold text-teal-700 underline underline-offset-2 hover:text-teal-900"
          href="/host/organization"
        >
          Manage plan
        </Link>
      ) : null}
    </div>
  );
}
