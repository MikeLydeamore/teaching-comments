import { describe, expect, it } from "vitest";
import {
  STUDENT_PRESENCE_HEARTBEAT_INTERVAL_MS,
  studentPresenceHeartbeatIsDue,
} from "./student-presence";

describe("student presence heartbeat", () => {
  it("is due immediately and then at most once every ten seconds", () => {
    expect(studentPresenceHeartbeatIsDue(null, 1_000)).toBe(true);
    expect(studentPresenceHeartbeatIsDue(1_000, 10_999)).toBe(false);
    expect(
      studentPresenceHeartbeatIsDue(
        1_000,
        1_000 + STUDENT_PRESENCE_HEARTBEAT_INTERVAL_MS,
      ),
    ).toBe(true);
  });
});
