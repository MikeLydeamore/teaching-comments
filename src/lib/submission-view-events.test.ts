import { describe, expect, it } from "vitest";
import {
  encodeSubmissionViewEvent,
  isSubmissionViewInvalidation,
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
});

