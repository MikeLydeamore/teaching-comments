import "server-only";

import Redis from "ioredis";
import { validatePollParticipantId } from "./edie-store-model";
import { submissionViewInvalidationPayload } from "./submission-view-events";

const CHANNEL_PREFIX = "edie:submission-view";
const PRESENCE_KEY_PREFIX = "edie:session-presence";
const PRESENCE_ACTIVE_WINDOW_MS = 25_000;
const PUBLISH_CONNECT_TIMEOUT_MS = 2_000;
const PUBLISH_COMMAND_TIMEOUT_MS = 2_000;

const ADMIT_PARTICIPANT_SCRIPT = `
redis.call("ZREMRANGEBYSCORE", KEYS[1], "-inf", ARGV[1])
local existing = redis.call("ZSCORE", KEYS[1], ARGV[3])
if existing then
  redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])
  return {1, redis.call("ZCARD", KEYS[1])}
end
local count = redis.call("ZCARD", KEYS[1])
local limit = tonumber(ARGV[4])
if limit < 0 or count < limit then
  redis.call("ZADD", KEYS[1], ARGV[2], ARGV[3])
  return {1, count + 1}
end
return {0, count}
`;

export type ParticipantAdmission = {
  status: "admitted" | "full";
  connectedParticipants: number | null;
};

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

export async function admitSessionParticipant(
  sessionId: string,
  participantId: string,
  limit: number | null,
  currentTime = Date.now(),
): Promise<ParticipantAdmission> {
  const url = redisUrl();

  if (!url) {
    return { status: "admitted", connectedParticipants: null };
  }

  let normalizedParticipantId: string;
  try {
    normalizedParticipantId = validatePollParticipantId(participantId);
  } catch {
    throw new Error("A valid participant identifier is required.");
  }

  const client = reusableCommandClient(url);

  try {
    const result = (await client.eval(
      ADMIT_PARTICIPANT_SCRIPT,
      1,
      sessionPresenceKey(sessionId),
      currentTime - PRESENCE_ACTIVE_WINDOW_MS,
      currentTime,
      normalizedParticipantId,
      limit === null ? -1 : limit,
    )) as [number, number];

    return {
      status: Number(result[0]) === 1 ? "admitted" : "full",
      connectedParticipants: Number(result[1]),
    };
  } catch (error) {
    logRedisFailure("presence-write", error);
    discardCommandClient(client);
    return { status: "admitted", connectedParticipants: null };
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
