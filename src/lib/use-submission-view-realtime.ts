"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseSubmissionViewPresence,
  type SubmissionViewRealtimeStatus,
} from "./submission-view-events";

const POLL_INTERVAL_MS = 3_000;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

type UseSubmissionViewRealtimeOptions = {
  refresh: () => Promise<unknown> | unknown;
  sessionCode: string;
};

export function submissionViewReconnectDelay(attempt: number) {
  return RECONNECT_DELAYS_MS[
    Math.min(Math.max(0, attempt), RECONNECT_DELAYS_MS.length - 1)
  ];
}

export function useSubmissionViewRealtime({
  refresh,
  sessionCode,
}: UseSubmissionViewRealtimeOptions): {
  connectedParticipants: number | null;
  status: SubmissionViewRealtimeStatus;
} {
  const refreshRef = useRef(refresh);
  const [status, setStatus] =
    useState<SubmissionViewRealtimeStatus>("reconnecting");
  const [connectedParticipants, setConnectedParticipants] = useState<
    number | null
  >(null);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    let disposed = false;
    let eventSource: EventSource | null = null;
    let pollTimer: number | null = null;
    let reconnectTimer: number | null = null;
    let reconnectAttempt = 0;
    let refreshInFlight = false;
    let refreshQueued = false;

    const requestRefresh = () => {
      if (disposed) return;
      refreshQueued = true;

      if (refreshInFlight) return;
      refreshInFlight = true;

      void (async () => {
        while (refreshQueued && !disposed) {
          refreshQueued = false;
          await Promise.resolve(refreshRef.current()).catch(() => {});
        }
        refreshInFlight = false;
      })();
    };

    const stopPolling = () => {
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      if (disposed) return;
      setStatus("polling");

      if (pollTimer === null) {
        pollTimer = window.setInterval(() => {
          if (document.visibilityState === "visible") {
            requestRefresh();
          }
        }, POLL_INTERVAL_MS);
      }
    };

    const clearReconnectTimer = () => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = () => {
      if (disposed || eventSource) return;
      clearReconnectTimer();
      setStatus("reconnecting");
      setConnectedParticipants(null);

      const nextSource = new EventSource(
        `/api/sessions/${encodeURIComponent(sessionCode)}/submission-view/events`,
      );
      eventSource = nextSource;

      nextSource.addEventListener("ready", () => {
        if (disposed || eventSource !== nextSource) return;
        reconnectAttempt = 0;
        stopPolling();
        setStatus("live");
        requestRefresh();
      });

      nextSource.addEventListener("submission-view-invalidated", () => {
        if (!disposed && eventSource === nextSource) {
          requestRefresh();
        }
      });

      nextSource.addEventListener("participant-presence", (event) => {
        if (disposed || eventSource !== nextSource) return;
        const nextCount = parseSubmissionViewPresence(event.data);

        if (nextCount !== undefined) {
          setConnectedParticipants(nextCount);
        }
      });

      nextSource.addEventListener("degraded", () => {
        if (!disposed && eventSource === nextSource) {
          setConnectedParticipants(null);
          startPolling();
          requestRefresh();
        }
      });

      const scheduleReconnect = (immediate = false) => {
        if (disposed || eventSource !== nextSource) return;
        nextSource.close();
        eventSource = null;
        setConnectedParticipants(null);
        startPolling();
        clearReconnectTimer();
        const delay = immediate
          ? 0
          : submissionViewReconnectDelay(reconnectAttempt++);
        reconnectTimer = window.setTimeout(connect, delay);
      };

      nextSource.addEventListener("reconnect", () => {
        requestRefresh();
        scheduleReconnect(true);
      });
      nextSource.onerror = () => scheduleReconnect();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        requestRefresh();
        connect();
      }
    };
    const handleOnline = () => {
      requestRefresh();
      reconnectAttempt = 0;
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      connect();
    };
    const handleOffline = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      clearReconnectTimer();
      setConnectedParticipants(null);
      startPolling();
    };

    startPolling();
    connect();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      disposed = true;
      eventSource?.close();
      stopPolling();
      clearReconnectTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [sessionCode]);

  return { connectedParticipants, status };
}
