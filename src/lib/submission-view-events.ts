export const SUBMISSION_VIEW_EVENT_VERSION = 1 as const;

export type SubmissionViewRealtimeStatus =
  | "live"
  | "polling"
  | "reconnecting";

export type SubmissionViewServerEvent =
  | "degraded"
  | "participant-presence"
  | "ready"
  | "reconnect"
  | "submission-view-invalidated";

type SubmissionViewEventPayload = {
  version: typeof SUBMISSION_VIEW_EVENT_VERSION;
};

type SubmissionViewPresencePayload = SubmissionViewEventPayload & {
  connectedParticipants: number | null;
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

export function encodeSubmissionViewPresenceEvent(
  connectedParticipants: number | null,
): string {
  return `event: participant-presence\ndata: ${JSON.stringify({
    version: SUBMISSION_VIEW_EVENT_VERSION,
    connectedParticipants,
  })}\n\n`;
}

export function parseSubmissionViewPresence(
  value: string,
): number | null | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<SubmissionViewPresencePayload>;

    if (parsed.version !== SUBMISSION_VIEW_EVENT_VERSION) {
      return undefined;
    }

    if (parsed.connectedParticipants === null) {
      return null;
    }

    return typeof parsed.connectedParticipants === "number" &&
      Number.isSafeInteger(parsed.connectedParticipants) &&
      parsed.connectedParticipants >= 0
      ? parsed.connectedParticipants
      : undefined;
  } catch {
    return undefined;
  }
}
