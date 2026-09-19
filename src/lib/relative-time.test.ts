import { describe, expect, it } from "vitest";
import { formatTimeAgo } from "./relative-time";

const NOW = new Date("2026-09-19T12:00:00.000Z").getTime();

function minutesAgo(minutes: number) {
  return new Date(NOW - minutes * 60 * 1000).toISOString();
}

describe("formatTimeAgo", () => {
  it.each([
    [0, "just now"],
    [1, "1 min ago"],
    [59, "59 min ago"],
    [60, "1 hour ago"],
    [120, "2 hours ago"],
    [23 * 60, "23 hours ago"],
    [24 * 60, "1 day ago"],
    [10_000, "6 days ago"],
  ])("formats a submission from %i minutes ago", (minutes, expected) => {
    expect(formatTimeAgo(minutesAgo(minutes), NOW)).toBe(expected);
  });

  it("treats future timestamps as just now", () => {
    expect(formatTimeAgo(minutesAgo(-5), NOW)).toBe("just now");
  });

  it("handles invalid timestamps", () => {
    expect(formatTimeAgo("not-a-date", NOW)).toBe("just now");
  });
});
