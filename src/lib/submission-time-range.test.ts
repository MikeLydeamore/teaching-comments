import { describe, expect, it } from "vitest";
import {
  parseSubmissionMinutes,
  submissionTimeRangeLabel,
} from "./submission-time-range";

describe("submission time ranges", () => {
  it("preserves zero as the all-time sentinel", () => {
    expect(parseSubmissionMinutes("0")).toBe(0);
    expect(submissionTimeRangeLabel(0)).toBe("All time");
  });

  it("defaults invalid or missing values and clamps the supported range", () => {
    expect(parseSubmissionMinutes(undefined)).toBe(3);
    expect(parseSubmissionMinutes("")).toBe(3);
    expect(parseSubmissionMinutes("invalid")).toBe(3);
    expect(parseSubmissionMinutes("-1")).toBe(0);
    expect(parseSubmissionMinutes("501")).toBe(500);
  });

  it("formats bounded time ranges", () => {
    expect(submissionTimeRangeLabel(1)).toBe("Last 1 minute");
    expect(submissionTimeRangeLabel(3)).toBe("Last 3 minutes");
  });
});
