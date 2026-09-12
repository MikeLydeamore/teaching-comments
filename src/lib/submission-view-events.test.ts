import { describe, expect, it } from "vitest";
import {
  encodeSubmissionViewEvent,
  encodeSubmissionViewPresenceEvent,
  isSubmissionViewInvalidation,
  parseSubmissionViewPresence,
  submissionViewInvalidationPayload,
} from "./submission-view-events";

describe("submission view events", () => {
  it("serializes versioned invalidations without submission content", () => {
    expect(submissionViewInvalidationPayload()).toBe('{"version":1}');
    expect(
      encodeSubmissionViewEvent("submission-view-invalidated"),
    ).toBe(
      'event: submission-view-invalidated\ndata: {"version":1}\n\n',
    );
  });

  it("accepts only the current invalidation version", () => {
    expect(isSubmissionViewInvalidation('{"version":1}')).toBe(true);
    expect(isSubmissionViewInvalidation('{"version":2}')).toBe(false);
    expect(isSubmissionViewInvalidation("not-json")).toBe(false);
  });

  it("serializes and parses participant presence", () => {
    expect(encodeSubmissionViewPresenceEvent(12)).toBe(
      'event: participant-presence\ndata: {"version":1,"connectedParticipants":12}\n\n',
    );
    expect(
      parseSubmissionViewPresence(
        '{"version":1,"connectedParticipants":12}',
      ),
    ).toBe(12);
    expect(
      parseSubmissionViewPresence(
        '{"version":1,"connectedParticipants":null}',
      ),
    ).toBeNull();
  });

  it("rejects malformed or incompatible participant presence", () => {
    expect(
      parseSubmissionViewPresence(
        '{"version":2,"connectedParticipants":12}',
      ),
    ).toBeUndefined();
    expect(
      parseSubmissionViewPresence(
        '{"version":1,"connectedParticipants":-1}',
      ),
    ).toBeUndefined();
    expect(parseSubmissionViewPresence("not-json")).toBeUndefined();
  });
});
