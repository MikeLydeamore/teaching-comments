import type { SessionPoll } from "./edie-store-model";

export function pollVotingHasEnded(poll: SessionPoll, nowMs: number) {
  return (
    poll.votingEndedAt !== null ||
    (nowMs > 0 && new Date(poll.endsAt).getTime() <= nowMs)
  );
}

export function pollIsCurrentlyLive(poll: SessionPoll, nowMs: number) {
  return poll.status === "active" && !pollVotingHasEnded(poll, nowMs);
}
