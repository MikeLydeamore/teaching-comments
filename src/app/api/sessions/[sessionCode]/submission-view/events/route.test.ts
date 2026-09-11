import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { authorizationMock, createSubscriberMock } = vi.hoisted(() => ({
  authorizationMock: vi.fn(),
  createSubscriberMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/teacher-session-auth", () => ({
  getAuthorizedTeacherSession: authorizationMock,
}));
vi.mock("@/lib/submission-view-events", () => ({
  encodeSubmissionViewEvent: (event: string) =>
    `event: ${event}\ndata: {"version":1}\n\n`,
  isSubmissionViewInvalidation: (message: string) =>
    message === '{"version":1}',
}));
vi.mock("@/lib/submission-view-realtime", () => ({
  createSubmissionViewSubscriber: createSubscriberMock,
  submissionViewRealtimeChannel: (sessionId: string) =>
    `edie:submission-view:${sessionId}`,
}));

import { GET } from "./route";

const context = {
  params: Promise.resolve({ sessionCode: "session-1" }),
};

function fakeSubscriber() {
  const subscriber = new EventEmitter() as EventEmitter & {
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    status: string;
    subscribe: ReturnType<typeof vi.fn>;
  };
  subscriber.status = "wait";
  subscriber.connect = vi.fn(async () => {
    subscriber.status = "ready";
  });
  subscriber.subscribe = vi.fn(async () => 1);
  subscriber.disconnect = vi.fn();
  return subscriber;
}

beforeEach(() => {
  authorizationMock.mockReset();
  createSubscriberMock.mockReset();
  authorizationMock.mockResolvedValue({ session: { id: "internal-session-1" } });
});

describe("submission view event stream", () => {
  it("requires teacher authorization before opening a subscription", async () => {
    authorizationMock.mockResolvedValue({
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(
      new Request(
        "https://example.test/api/sessions/session-1/submission-view/events",
      ),
      context as never,
    );

    expect(response.status).toBe(401);
    expect(createSubscriberMock).not.toHaveBeenCalled();
  });

  it("returns unavailable when Redis is not configured", async () => {
    createSubscriberMock.mockReturnValue(null);

    const response = await GET(
      new Request(
        "https://example.test/api/sessions/session-1/submission-view/events",
      ),
      context as never,
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("10");
  });

  it("opens a private stream and announces readiness", async () => {
    const subscriber = fakeSubscriber();
    createSubscriberMock.mockReturnValue(subscriber);

    const response = await GET(
      new Request(
        "https://example.test/api/sessions/session-1/submission-view/events",
      ),
      context as never,
    );
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const firstChunk = await reader.read();
    const secondChunk = await reader.read();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(decoder.decode(firstChunk.value)).toContain("retry: 1000");
    expect(decoder.decode(secondChunk.value)).toContain("event: ready");
    expect(subscriber.subscribe).toHaveBeenCalledWith(
      "edie:submission-view:internal-session-1",
    );

    subscriber.emit(
      "message",
      "edie:submission-view:internal-session-1",
      '{"version":1}',
    );
    const invalidationChunk = await reader.read();
    expect(decoder.decode(invalidationChunk.value)).toContain(
      "event: submission-view-invalidated",
    );

    subscriber.emit("reconnecting");
    const degradedChunk = await reader.read();
    expect(decoder.decode(degradedChunk.value)).toContain("event: degraded");

    await reader.cancel();
    expect(subscriber.disconnect).toHaveBeenCalled();
  });
});
