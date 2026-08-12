"use client";

import { useEffect, useRef, useState } from "react";

const RETRY_DELAYS_MS = [750, 1_500, 3_000, 6_000, 10_000] as const;

type PreviewState = "loading" | "retrying" | "loaded" | "failed";

type SubmissionImagePreviewProps = {
  className?: string;
  url: string;
};

export function submissionImageRetryUrl(url: string, attempt: number) {
  if (attempt === 0) {
    return url;
  }

  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}imageRetry=${attempt}`;
}

export function SubmissionImagePreview({
  className = "max-h-80 rounded-md border border-slate-200",
  url,
}: SubmissionImagePreviewProps) {
  const [attempt, setAttempt] = useState(0);
  const [previewState, setPreviewState] = useState<PreviewState>("loading");
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<number | null>(null);

  function clearRetryTimer() {
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }

  useEffect(
    () => () => {
      if (retryTimerRef.current !== null) {
        window.clearTimeout(retryTimerRef.current);
      }
    },
    [],
  );

  function handleLoad() {
    clearRetryTimer();
    setPreviewState("loaded");
  }

  function handleError() {
    if (retryTimerRef.current !== null) {
      return;
    }

    const retryDelay = RETRY_DELAYS_MS[retryCountRef.current];
    if (retryDelay === undefined) {
      setPreviewState("failed");
      return;
    }

    setPreviewState("retrying");
    retryTimerRef.current = window.setTimeout(() => {
      retryTimerRef.current = null;
      retryCountRef.current += 1;
      setAttempt((currentAttempt) => currentAttempt + 1);
      setPreviewState("loading");
    }, retryDelay);
  }

  function retryNow() {
    clearRetryTimer();
    retryCountRef.current = 0;
    setAttempt((currentAttempt) => currentAttempt + 1);
    setPreviewState("loading");
  }

  const isLoaded = previewState === "loaded";

  return (
    <div className="relative mt-3" data-no-card-drag="true">
      <a
        aria-hidden={!isLoaded}
        className={
          isLoaded
            ? "block w-fit cursor-auto"
            : "pointer-events-none absolute size-px overflow-hidden opacity-0"
        }
        href={url}
        rel="noreferrer"
        tabIndex={isLoaded ? undefined : -1}
        target="_blank"
      >
        {/* The authenticated, no-store endpoint is intentionally loaded directly. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt="Student submitted image"
          className={className}
          key={attempt}
          src={submissionImageRetryUrl(url, attempt)}
          onError={handleError}
          onLoad={handleLoad}
        />
      </a>

      {!isLoaded ? (
        <div
          aria-live="polite"
          className="flex min-h-24 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm font-medium text-slate-600"
          role="status"
        >
          {previewState === "failed" ? (
            <div>
              <p>Image could not be loaded.</p>
              <button
                className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800"
                type="button"
                onClick={retryNow}
              >
                Retry image
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-700"
              />
              <span>
                {previewState === "retrying"
                  ? "Image unavailable. Retrying automatically…"
                  : "Loading image…"}
              </span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
