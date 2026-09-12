import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  disconnectMock,
  publishMock,
  zaddMock,
  zcardMock,
  zremrangebyscoreMock,
} = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  publishMock: vi.fn(),
  zaddMock: vi.fn(),
  zcardMock: vi.fn(),
  zremrangebyscoreMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("ioredis", () => ({
  default: class FakeRedis {
    disconnect = disconnectMock;
    publish = publishMock;
    zadd = zaddMock;
    zcard = zcardMock;
    zremrangebyscore = zremrangebyscoreMock;
    on() {
      return this;
    }
  },
}));

import {
  countSessionPresence,
  publishSubmissionViewInvalidation,
  recordSessionPresence,
  sessionPresenceKey,
  submissionViewRealtimeChannel,
  submissionViewRealtimeConfigured,
} from "./submission-view-realtime";

const previousRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  disconnectMock.mockReset();
  publishMock.mockReset();
  zaddMock.mockReset();
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
    await expect(
      recordSessionPresence("session-1", "participant_123"),
    ).resolves.toBe(false);
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

  it("records validated anonymous presence under an opaque session key", async () => {
    process.env.REDIS_URL = "rediss://example.test";
    zaddMock.mockResolvedValue(1);

    await expect(
      recordSessionPresence("space-a/session", "participant_123", 50_000),
    ).resolves.toBe(true);

    const key = sessionPresenceKey("space-a/session");
    expect(key).toMatch(/^edie:session-presence:/);
    expect(key).not.toContain("space-a/session");
    expect(zaddMock).toHaveBeenCalledWith(key, 50_000, "participant_123");
  });

  it("ignores malformed participant IDs", async () => {
    process.env.REDIS_URL = "rediss://example.test";

    await expect(
      recordSessionPresence("session-1", "short", 50_000),
    ).resolves.toBe(false);
    expect(zaddMock).not.toHaveBeenCalled();
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
