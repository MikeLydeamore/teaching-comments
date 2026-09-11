"use client";

import type { SubmissionViewRealtimeStatus } from "@/lib/submission-view-events";

const statusDetails: Record<
  SubmissionViewRealtimeStatus,
  { className: string; label: string; title: string }
> = {
  live: {
    className: "border-teal-200 bg-teal-50 text-teal-800",
    label: "Live",
    title: "Submission updates are arriving live.",
  },
  polling: {
    className: "border-amber-200 bg-amber-50 text-amber-800",
    label: "Polling",
    title: "Live updates are unavailable. Checking every three seconds.",
  },
  reconnecting: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    label: "Reconnecting",
    title: "Connecting to live submission updates.",
  },
};

export function SubmissionViewConnectionBadge({
  status,
}: {
  status: SubmissionViewRealtimeStatus;
}) {
  const details = statusDetails[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${details.className}`}
      role="status"
      title={details.title}
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          status === "live"
            ? "bg-teal-600"
            : status === "polling"
              ? "bg-amber-500"
              : "bg-slate-400"
        }`}
      />
      {details.label}
    </span>
  );
}
