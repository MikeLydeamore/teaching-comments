"use client";

import type { SubmissionViewRealtimeStatus } from "@/lib/submission-view-events";

export function ConnectedParticipantBadge({
  connectedParticipants,
  status,
}: {
  connectedParticipants: number | null;
  status: SubmissionViewRealtimeStatus;
}) {
  const isValid = status === "live" && connectedParticipants !== null;
  const isReconnecting = status === "reconnecting";
  const label = `${isValid ? connectedParticipants : "—"} connected`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        isValid
          ? "border-teal-200 bg-teal-50 text-teal-800"
          : isReconnecting
            ? "border-slate-200 bg-slate-50 text-slate-600"
            : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
      title={
        isValid
          ? "Anonymous browser profiles active on the student form in approximately the last 30 seconds."
          : isReconnecting
            ? "Reconnecting before checking the active student count."
            : "The active student count is temporarily unavailable."
      }
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          isValid
            ? "bg-teal-600"
            : isReconnecting
              ? "bg-slate-400"
              : "bg-amber-500"
        }`}
      />
      {label}
    </span>
  );
}
