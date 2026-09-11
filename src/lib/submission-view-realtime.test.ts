import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { disconnectMock, publishMock } = vi.hoisted(() => ({
  disconnectMock: vi.fn(),
  publishMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("ioredis", () => ({
  default: class FakeRedis {
    disconnect = disconnectMock;
    publish = publishMock;
    on() {
      return this;
    }
  },
}));

import {
  publishSubmissionViewInvalidation,
  submissionViewRealtimeChannel,
  submissionViewRealtimeConfigured,
} from "./submission-view-realtime";

const previousRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  disconnectMock.mockReset();
  publishMock.mockReset();
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
});
