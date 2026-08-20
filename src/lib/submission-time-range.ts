const DEFAULT_SUBMISSION_MINUTES = 3;
const MAX_SUBMISSION_MINUTES = 500;

export function parseSubmissionMinutes(value: string | undefined) {
  if (value === undefined || value === "") {
    return DEFAULT_SUBMISSION_MINUTES;
  }

  const minutes = Number(value);

  if (!Number.isFinite(minutes)) {
    return DEFAULT_SUBMISSION_MINUTES;
  }

  return Math.min(MAX_SUBMISSION_MINUTES, Math.max(0, minutes));
}

export function submissionTimeRangeLabel(minutes: number) {
  if (minutes === 0) {
    return "All time";
  }

  return `Last ${minutes} minute${minutes === 1 ? "" : "s"}`;
}
