import { describe, expect, it } from "vitest";
import type { SessionPoll } from "./edie-store-model";
import { pollIsCurrentlyLive, pollVotingHasEnded } from "./poll-state";

const poll = {
  status: "active",
  endsAt: "2099-01-01T00:00:00.000Z",
  votingEndedAt: null,
} as SessionPoll;

describe("poll voting state", () => {
  it("ends voting explicitly without relying on the viewer's clock", () => {
    const endedPoll = {
      ...poll,
      votingEndedAt: "2026-09-12T11:00:00.000Z",
    };

    expect(pollVotingHasEnded(endedPoll, 1)).toBe(true);
    expect(pollIsCurrentlyLive(endedPoll, 1)).toBe(false);
  });

  it("still ends voting when the scheduled deadline passes naturally", () => {
    expect(pollVotingHasEnded(poll, Date.parse(poll.endsAt) + 1)).toBe(true);
  });
});
