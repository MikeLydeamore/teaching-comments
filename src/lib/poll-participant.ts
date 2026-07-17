const pollParticipantStorageKey = "qwt_poll_participant_id";

function createParticipantId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreatePollParticipantId() {
  const existing = window.localStorage.getItem(pollParticipantStorageKey);

  if (existing) {
    return existing;
  }

  const participantId = createParticipantId();
  window.localStorage.setItem(pollParticipantStorageKey, participantId);
  return participantId;
}
