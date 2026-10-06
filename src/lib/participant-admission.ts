import "server-only";

import type { Session } from "./edie-store-model";
import { validatePollParticipantId } from "./edie-store-model";
import { getTeacherSpace } from "./edie-store";
import { entitlementsForOrganization } from "./entitlements";
import {
  admitSessionParticipant,
  type ParticipantAdmission,
} from "./submission-view-realtime";
import { SESSION_CAPACITY_ERROR_CODE } from "./participant-capacity";

export const SESSION_CAPACITY_RETRY_SECONDS = 3;

export type SessionAdmission = ParticipantAdmission & {
  limit: number | null;
};

export async function admitParticipant(
  session: Session,
  participantId: string,
): Promise<SessionAdmission> {
  const normalizedParticipantId = validatePollParticipantId(participantId);
  const space = await getTeacherSpace(session.spaceCode);

  if (!space) {
    console.error("[participant-admission] Session space could not be resolved.", {
      sessionId: session.id,
    });
    return { status: "admitted", connectedParticipants: null, limit: null };
  }

  const entitlements = await entitlementsForOrganization(space.organizationId);
  const limit = entitlements.limits.concurrentParticipants;
  const admission = await admitSessionParticipant(
    session.id,
    normalizedParticipantId,
    limit,
  );

  return { ...admission, limit };
}

export function capacityReachedResponse() {
  return Response.json(
    {
      code: SESSION_CAPACITY_ERROR_CODE,
      error: "This session is currently full. Keep this page open and try again shortly.",
    },
    {
      status: 429,
      headers: { "Retry-After": String(SESSION_CAPACITY_RETRY_SECONDS) },
    },
  );
}

export async function requireParticipantAdmission(
  session: Session,
  participantId: string,
) {
  const admission = await admitParticipant(session, participantId);
  return admission.status === "full" ? capacityReachedResponse() : null;
}
