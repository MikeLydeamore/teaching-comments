"use client";

export function ConnectedParticipantBadge({
  connectedParticipants,
}: {
  connectedParticipants: number | null;
}) {
  const unavailable = connectedParticipants === null;
  const label = unavailable
    ? "Connected: unavailable"
    : `${connectedParticipants} connected`;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        unavailable
          ? "border-slate-200 bg-slate-50 text-slate-600"
          : "border-teal-200 bg-teal-50 text-teal-800"
      }`}
      title={
        unavailable
          ? "The active student count is temporarily unavailable."
          : "Anonymous browser profiles active on the student form in approximately the last 30 seconds."
      }
    >
      <span
        aria-hidden="true"
        className={`size-1.5 rounded-full ${
          unavailable ? "bg-slate-400" : "bg-teal-600"
        }`}
      />
      {label}
    </span>
  );
}
