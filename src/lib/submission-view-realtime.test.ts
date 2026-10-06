import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  disconnectMock,
  evalMock,
  publishMock,
  zcardMock,
  zremrangebyscoreMock,
} = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  evalMock: vi.fn(),
  publishMock: vi.fn(),
  zcardMock: vi.fn(),
  zremrangebyscoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("ioredis", () => ({
  default: class FakeRedis {
    disconnect = disconnectMock;
    eval = evalMock;
    publish = publishMock;
    zcard = zcardMock;
    zremrangebyscore = zremrangebyscoreMock;
    on() {
      return this;
    }
  },
}));

import {
  admitSessionParticipant,
  countSessionPresence,
  publishSubmissionViewInvalidation,
  sessionPresenceKey,
  submissionViewRealtimeChannel,
  submissionViewRealtimeConfigured,
} from "./submission-view-realtime";

const previousRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  disconnectMock.mockReset();
  evalMock.mockReset();
  publishMock.mockReset();
  zcardMock.mockReset();
  zremrangebyscoreMock.mockReset();
});

afterEach(() => {
  if (previousRedisUrl === undefined) {
    delete process.env.REDIS_URL;
  } else {
    process.env.REDIS_URL = previousRedisUrl;
  }
});

describe("submission view realtime", () => {
  it("uses isolated, opaque channels for each session", () => {
    const first = submissionViewRealtimeChannel("space-a/session");
    const second = submissionViewRealtimeChannel("space-b/session");

    expect(first).toMatch(/^edie:submission-view:/);
    expect(first).not.toContain("space-a/session");
    expect(first).not.toBe(second);
  });

  it("is disabled and publishes safely when Redis is not configured", async () => {
    delete process.env.REDIS_URL;

    expect(submissionViewRealtimeConfigured()).toBe(false);
    await expect(publishSubmissionViewInvalidation("session-1")).resolves.toBe(
      false,
    );
    await expect(admitSessionParticipant("session-1", "participant_123", 30))
      .resolves.toEqual({ status: "admitted", connectedParticipants: null });
    await expect(countSessionPresence("session-1")).resolves.toBeNull();
  });

  it("publishes only the versioned invalidation payload", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    publishMock.mockResolvedValue(1);

    await expect(publishSubmissionViewInvalidation("session-1")).resolves.toBe(
      true,
    );
    expect(publishMock).toHaveBeenCalledWith(
      submissionViewRealtimeChannel("session-1"),
      '{"version":1}',
    );
  });

  it("contains Redis failures instead of rejecting the saved mutation", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    publishMock.mockRejectedValue(new Error("unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(publishSubmissionViewInvalidation("session-1")).resolves.toBe(
      false,
    );
    expect(disconnectMock).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it("atomically admits a participant under an opaque session key", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    evalMock.mockResolvedValue([1, 3]);

    await expect(
      admitSessionParticipant("space-a/session", "participant_123", 30, 50_000),
    ).resolves.toEqual({ status: "admitted", connectedParticipants: 3 });

    const key = sessionPresenceKey("space-a/session");
    expect(key).toMatch(/^edie:session-presence:/);
    expect(key).not.toContain("space-a/session");
    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('redis.call("ZREMRANGEBYSCORE"'),
      1,
      key,
      25_000,
      50_000,
      "participant_123",
      30,
    );
  });

  it("reports full capacity and supports unlimited admission", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    evalMock.mockResolvedValueOnce([0, 30]).mockResolvedValueOnce([1, 31]);

    await expect(
      admitSessionParticipant("session-1", "participant_123", 30, 50_000),
    ).resolves.toEqual({ status: "full", connectedParticipants: 30 });
    await expect(
      admitSessionParticipant("session-1", "participant_456", null, 50_000),
    ).resolves.toEqual({ status: "admitted", connectedParticipants: 31 });
    expect(evalMock.mock.calls[1].at(-1)).toBe(-1);
  });

  it("rejects malformed participant IDs", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    await expect(admitSessionParticipant("session-1", "short", 30, 50_000))
      .rejects.toThrow("participant identifier");
    expect(evalMock).not.toHaveBeenCalled();
  });

  it("fails open when atomic admission is unavailable", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    evalMock.mockRejectedValue(new Error("unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(admitSessionParticipant("session-1", "participant_123", 30))
      .resolves.toEqual({ status: "admitted", connectedParticipants: null });
    expect(disconnectMock).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("prunes stale presence before returning the unique count", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    zremrangebyscoreMock.mockResolvedValue(2);
    zcardMock.mockResolvedValue(3);

    await expect(countSessionPresence("session-1", 100_000)).resolves.toBe(3);
    expect(zremrangebyscoreMock).toHaveBeenCalledWith(
      sessionPresenceKey("session-1"),
      "-inf",
      75_000,
    );
    expect(zcardMock).toHaveBeenCalledWith(sessionPresenceKey("session-1"));
  });

  it("returns unavailable when presence Redis operations fail", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    zremrangebyscoreMock.mockRejectedValue(new Error("unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(countSessionPresence("session-1", 100_000)).resolves.toBeNull();
    expect(disconnectMock).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();

    consoleError.mockRestore();
  });
});
