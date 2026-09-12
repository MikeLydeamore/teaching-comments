import "server-only";

import Redis from "ioredis";
import { validatePollParticipantId } from "./edie-store-model";
import { submissionViewInvalidationPayload } from "./submission-view-events";

const CHANNEL_PREFIX = "edie:submission-view";
const PRESENCE_KEY_PREFIX = "edie:session-presence";
const PRESENCE_ACTIVE_WINDOW_MS = 25_000;
const PUBLISH_CONNECT_TIMEOUT_MS = 2_000;
const PUBLISH_COMMAND_TIMEOUT_MS = 2_000;

let commandClient: Redis | null = null;

function redisUrl() {
  const value = process.env.REDIS_URL?.trim();
  return value || null;
}

function logRedisFailure(
  operation: "presence-read" | "presence-write" | "publish" | "subscribe",
  error: unknown,
) {
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

function createCommandClient(url: string) {
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

export function sessionPresenceKey(sessionId: string) {
  const encodedSessionId = Buffer.from(sessionId, "utf8").toString("base64url");
  return `${PRESENCE_KEY_PREFIX}:${encodedSessionId}`;
}

function reusableCommandClient(url: string) {
  const client = commandClient ?? createCommandClient(url);
  commandClient = client;
  return client;
}

function discardCommandClient(client: Redis) {
  client.disconnect();
  if (commandClient === client) {
    commandClient = null;
  }
}

export async function publishSubmissionViewInvalidation(
  sessionId: string,
): Promise<boolean> {
  const url = redisUrl();

  if (!url) {
    return false;
  }

  const client = reusableCommandClient(url);

  try {
    await client.publish(
      submissionViewRealtimeChannel(sessionId),
      submissionViewInvalidationPayload(),
    );
    return true;
  } catch (error) {
    logRedisFailure("publish", error);
    discardCommandClient(client);
    return false;
  }
}

export async function recordSessionPresence(
  sessionId: string,
  participantId: string,
  currentTime = Date.now(),
): Promise<boolean> {
  const url = redisUrl();

  if (!url) {
    return false;
  }

  let normalizedParticipantId: string;
  try {
    normalizedParticipantId = validatePollParticipantId(participantId);
  } catch {
    return false;
  }

  const client = reusableCommandClient(url);

  try {
    await client.zadd(
      sessionPresenceKey(sessionId),
      currentTime,
      normalizedParticipantId,
    );
    return true;
  } catch (error) {
    logRedisFailure("presence-write", error);
    discardCommandClient(client);
    return false;
  }
}

export async function countSessionPresence(
  sessionId: string,
  currentTime = Date.now(),
): Promise<number | null> {
  const url = redisUrl();

  if (!url) {
    return null;
  }

  const client = reusableCommandClient(url);
  const key = sessionPresenceKey(sessionId);

  try {
    await client.zremrangebyscore(
      key,
      "-inf",
      currentTime - PRESENCE_ACTIVE_WINDOW_MS,
    );
    return await client.zcard(key);
  } catch (error) {
    logRedisFailure("presence-read", error);
    discardCommandClient(client);
    return null;
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
