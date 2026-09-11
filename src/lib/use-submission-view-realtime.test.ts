import { describe, expect, it } from "vitest";
import { submissionViewReconnectDelay } from "./use-submission-view-realtime";

describe("submission view realtime reconnects", () => {
  it("uses bounded exponential-style backoff", () => {
    expect([0, 1, 2, 3, 4, 5, 99].map(submissionViewReconnectDelay)).toEqual([
      1_000,
      2_000,
      5_000,
      10_000,
      30_000,
      30_000,
      30_000,
    ]);
  });
});

