import "server-only";

import Redis from "ioredis";
import { submissionViewInvalidationPayload } from "./submission-view-events";

const CHANNEL_PREFIX = "edie:submission-view";
const PUBLISH_CONNECT_TIMEOUT_MS = 2_000;
const PUBLISH_COMMAND_TIMEOUT_MS = 2_000;

let publisher: Redis | null = null;

function redisUrl() {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

function logRedisFailure(operation: "publish" | "subscribe", error: unknown) {
  const details =
    error && typeof error === "object"
      ? {
          code:
            "code" in error && typeof error.code === "string"
              ? error.code
              : undefined,
          name:
            "name" in error && typeof error.name === "string"
              ? error.name
              : "Error",
        }
      : { name: "Error" };

  console.error(`[submission-view-realtime] Redis ${operation} failed.`, details);
}

function createPublisher(url: string) {
  const client = new Redis(url, {
    commandTimeout: PUBLISH_COMMAND_TIMEOUT_MS,
    connectTimeout: PUBLISH_CONNECT_TIMEOUT_MS,
    maxRetriesPerRequest: 1,
    retryStrategy: () => null,
  });

  client.on("error", () => {
    // Individual commands report failures to their callers. Keeping this listener
    // prevents EventEmitter's special unhandled `error` behavior.
  });

  return client;
}

export function submissionViewRealtimeConfigured() {
  return redisUrl() !== null;
}

export function submissionViewRealtimeChannel(sessionId: string) {
  const encodedSessionId = Buffer.from(sessionId, "utf8").toString("base64url");
  return `${CHANNEL_PREFIX}:${encodedSessionId}`;
}

export async function publishSubmissionViewInvalidation(
  sessionId: string,
): Promise<boolean> {
  const url = redisUrl();

  if (!url) {
    return false;
  }

  const client = publisher ?? createPublisher(url);
  publisher = client;

  try {
    await client.publish(
      submissionViewRealtimeChannel(sessionId),
      submissionViewInvalidationPayload(),
    );
    return true;
  } catch (error) {
    logRedisFailure("publish", error);
    client.disconnect();
    if (publisher === client) {
      publisher = null;
    }
    return false;
  }
}

export function createSubmissionViewSubscriber(): Redis | null {
  const url = redisUrl();

  if (!url) {
    return null;
  }

  const client = new Redis(url, {
    connectTimeout: 3_000,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    retryStrategy: (attempt) => Math.min(attempt * 250, 5_000),
  });

  client.on("error", (error) => {
    logRedisFailure("subscribe", error);
  });

  return client;
}

