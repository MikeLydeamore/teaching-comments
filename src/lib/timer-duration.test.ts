import { describe, expect, it } from "vitest";
import {
  clampTimerSeconds,
  formatTimerSeconds,
  parseTimerDurationInput,
  POLL_TIMER_MIN_SECONDS,
  sanitizeTimerDraftValue,
  SESSION_TIMER_MIN_SECONDS,
  TIMER_MAX_SECONDS,
} from "./timer-duration";

describe("parseTimerDurationInput", () => {
  it("parses plain seconds", () => {
    expect(parseTimerDurationInput("90")).toBe(90);
    expect(parseTimerDurationInput(" 45 ")).toBe(45);
    expect(parseTimerDurationInput("0")).toBe(0);
  });

  it("parses minutes:seconds", () => {
    expect(parseTimerDurationInput("1:30")).toBe(90);
    expect(parseTimerDurationInput("0:30")).toBe(30);
    expect(parseTimerDurationInput(":30")).toBe(30);
    expect(parseTimerDurationInput("10:00")).toBe(600);
  });

  it("rejects malformed input", () => {
    expect(parseTimerDurationInput("")).toBe(null);
    expect(parseTimerDurationInput("   ")).toBe(null);
    expect(parseTimerDurationInput("abc")).toBe(null);
    expect(parseTimerDurationInput("1:2:3")).toBe(null);
    expect(parseTimerDurationInput("1:-5")).toBe(null);
    expect(parseTimerDurationInput("-1:00")).toBe(null);
    expect(parseTimerDurationInput("1:60")).toBe(null);
    expect(parseTimerDurationInput("1:90")).toBe(null);
  });
});

describe("clampTimerSeconds", () => {
  it("clamps to the per-context minimum and shared maximum", () => {
    expect(clampTimerSeconds(0, SESSION_TIMER_MIN_SECONDS)).toBe(
      SESSION_TIMER_MIN_SECONDS,
    );
    expect(clampTimerSeconds(3, POLL_TIMER_MIN_SECONDS)).toBe(
      POLL_TIMER_MIN_SECONDS,
    );
    expect(clampTimerSeconds(9999, SESSION_TIMER_MIN_SECONDS)).toBe(
      TIMER_MAX_SECONDS,
    );
    expect(clampTimerSeconds(-100, POLL_TIMER_MIN_SECONDS)).toBe(
      POLL_TIMER_MIN_SECONDS,
    );
  });

  it("rounds fractional seconds", () => {
    expect(clampTimerSeconds(30.4, SESSION_TIMER_MIN_SECONDS)).toBe(30);
    expect(clampTimerSeconds(30.6, SESSION_TIMER_MIN_SECONDS)).toBe(31);
  });

  it("falls back to 30 for non-finite values", () => {
    expect(clampTimerSeconds(Number.NaN, SESSION_TIMER_MIN_SECONDS)).toBe(30);
    expect(clampTimerSeconds(Number.POSITIVE_INFINITY, POLL_TIMER_MIN_SECONDS)).toBe(30);
  });
});

describe("sanitizeTimerDraftValue", () => {
  it("strips disallowed characters", () => {
    expect(sanitizeTimerDraftValue("1a2b3")).toBe("123");
    expect(sanitizeTimerDraftValue("a:b")).toBe(":");
    expect(sanitizeTimerDraftValue("x1:y30z")).toBe("1:30");
  });

  it("keeps only the first colon", () => {
    expect(sanitizeTimerDraftValue("1:2:3")).toBe("1:23");
    expect(sanitizeTimerDraftValue(":::")).toBe(":");
  });

  it("caps seconds at two digits", () => {
    expect(sanitizeTimerDraftValue("123")).toBe("123");
    expect(sanitizeTimerDraftValue("1:234")).toBe("1:23");
  });
});

describe("formatTimerSeconds", () => {
  it("formats m:ss and clamps negatives to zero", () => {
    expect(formatTimerSeconds(90)).toBe("1:30");
    expect(formatTimerSeconds(30)).toBe("0:30");
    expect(formatTimerSeconds(3600)).toBe("60:00");
    expect(formatTimerSeconds(-5)).toBe("0:00");
  });

  it("rounds up fractional remaining time", () => {
    expect(formatTimerSeconds(59.2)).toBe("1:00");
  });
});
