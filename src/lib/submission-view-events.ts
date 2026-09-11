export const SUBMISSION_VIEW_EVENT_VERSION = 1 as const;

export type SubmissionViewRealtimeStatus =
  | "live"
  | "polling"
  | "reconnecting";

export type SubmissionViewServerEvent =
  | "degraded"
  | "ready"
  | "reconnect"
  | "submission-view-invalidated";

type SubmissionViewEventPayload = {
  version: typeof SUBMISSION_VIEW_EVENT_VERSION;
};

export function submissionViewInvalidationPayload(): string {
  return JSON.stringify({ version: SUBMISSION_VIEW_EVENT_VERSION });
}

export function isSubmissionViewInvalidation(value: string): boolean {
  try {
    const parsed = JSON.parse(value) as Partial<SubmissionViewEventPayload>;
    return parsed.version === SUBMISSION_VIEW_EVENT_VERSION;
  } catch {
    return false;
  }
}

export function encodeSubmissionViewEvent(
  event: SubmissionViewServerEvent,
): string {
  return `event: ${event}\ndata: ${submissionViewInvalidationPayload()}\n\n`;
}

