import {
  encodeSubmissionViewEvent,
  encodeSubmissionViewPresenceEvent,
  isSubmissionViewInvalidation,
} from "@/lib/submission-view-events";
import {
  countSessionPresence,
  createSubmissionViewSubscriber,
  submissionViewRealtimeChannel,
} from "@/lib/submission-view-realtime";
import { getAuthorizedTeacherSession } from "@/lib/teacher-session-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const HEARTBEAT_INTERVAL_MS = 15_000;
const PRESENCE_INTERVAL_MS = 10_000;
const STREAM_RECYCLE_MS = 270_000;
const INITIAL_PADDING = `: ${" ".repeat(2_048)}\nretry: 1000\n\n`;

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/sessions/[sessionCode]/submission-view/events">,
) {
  const { sessionCode } = await ctx.params;
  const authorization = await getAuthorizedTeacherSession(sessionCode);

  if (authorization.response) {
    return authorization.response;
  }

  const subscriber = createSubmissionViewSubscriber();

  if (!subscriber) {
    return Response.json(
      { error: "Realtime submission updates are not configured." },
      { status: 503, headers: { "Retry-After": "10" } },
    );
  }

  const channel = submissionViewRealtimeChannel(authorization.session.id);
  const encoder = new TextEncoder();
  let cancelStream = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let connectionState: "connecting" | "degraded" | "ready" = "connecting";
      let subscribed = false;
      let presenceReadInFlight = false;

      const enqueue = (value: string) => {
        if (!closed) {
          controller.enqueue(encoder.encode(value));
        }
      };

      const setDegraded = () => {
        if (connectionState !== "degraded" && !closed) {
          connectionState = "degraded";
          enqueue(encodeSubmissionViewEvent("degraded"));
          enqueue(encodeSubmissionViewPresenceEvent(null));
        }
      };

      const setReady = () => {
        if (connectionState !== "ready" && !closed) {
          connectionState = "ready";
          enqueue(encodeSubmissionViewEvent("ready"));
        }
      };

      const onMessage = (receivedChannel: string, message: string) => {
        if (
          receivedChannel === channel &&
          isSubmissionViewInvalidation(message)
        ) {
          enqueue(encodeSubmissionViewEvent("submission-view-invalidated"));
        }
      };
      const onReady = () => {
        if (subscribed) {
          setReady();
        }
      };
      const onConnectionLost = () => setDegraded();
      const onError = () => setDegraded();

      const sendPresence = () => {
        if (closed || presenceReadInFlight) return;
        presenceReadInFlight = true;

        void countSessionPresence(authorization.session.id)
          .then((connectedParticipants) => {
            enqueue(
              encodeSubmissionViewPresenceEvent(connectedParticipants),
            );
          })
          .finally(() => {
            presenceReadInFlight = false;
          });
      };

      const heartbeat = setInterval(() => {
        enqueue(`: heartbeat ${Date.now()}\n\n`);
      }, HEARTBEAT_INTERVAL_MS);
      const presenceTimer = setInterval(sendPresence, PRESENCE_INTERVAL_MS);

      const cleanup = (closeController: boolean) => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        clearInterval(presenceTimer);
        clearTimeout(recycle);
        request.signal.removeEventListener("abort", onAbort);
        subscriber.off("message", onMessage);
        subscriber.off("ready", onReady);
        subscriber.off("close", onConnectionLost);
        subscriber.off("end", onConnectionLost);
        subscriber.off("reconnecting", onConnectionLost);
        subscriber.off("error", onError);
        subscriber.disconnect();

        if (closeController) {
          try {
            controller.close();
          } catch {
            // The browser may already have cancelled the response body.
          }
        }
      };

      const recycle = setTimeout(() => {
        enqueue(encodeSubmissionViewEvent("reconnect"));
        cleanup(true);
      }, STREAM_RECYCLE_MS);

      const onAbort = () => cleanup(true);
      cancelStream = () => cleanup(false);

      subscriber.on("message", onMessage);
      subscriber.on("ready", onReady);
      subscriber.on("close", onConnectionLost);
      subscriber.on("end", onConnectionLost);
      subscriber.on("reconnecting", onConnectionLost);
      subscriber.on("error", onError);
      request.signal.addEventListener("abort", onAbort, { once: true });

      enqueue(INITIAL_PADDING);

      void (async () => {
        try {
          if (subscriber.status === "wait") {
            await subscriber.connect();
          }
          await subscriber.subscribe(channel);
          subscribed = true;
          setReady();
          sendPresence();
        } catch {
          setDegraded();
        }
      })();
    },
    cancel() {
      cancelStream();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream; charset=utf-8",
      "X-Accel-Buffering": "no",
    },
  });
}
