"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  getHostOnboardingSnapshot,
  HOST_ONBOARDING_EVENT,
  hostOnboardingServerSnapshot,
  parseHostOnboardingState,
  subscribeToHostOnboarding,
  writeHostOnboardingState,
} from "@/lib/host-onboarding";

export function HostWelcome({
  hasSpaces,
  onboardingScope,
}: {
  hasSpaces: boolean;
  onboardingScope: string;
}) {
  const [wasRestarted, setWasRestarted] = useState(false);
  const snapshot = useSyncExternalStore(
    (onStoreChange) =>
      subscribeToHostOnboarding(onboardingScope, onStoreChange),
    () => getHostOnboardingSnapshot(onboardingScope),
    () => hostOnboardingServerSnapshot,
  );
  const onboardingState = useMemo(
    () => parseHostOnboardingState(snapshot),
    [snapshot],
  );
  const isVisible = wasRestarted || !onboardingState.welcomeDismissed;

  useEffect(() => {
    function restartWelcome(event: Event) {
      if ((event as CustomEvent).detail === "welcome") {
        setWasRestarted(true);
      }
    }

    window.addEventListener(HOST_ONBOARDING_EVENT, restartWelcome);
    return () => window.removeEventListener(HOST_ONBOARDING_EVENT, restartWelcome);
  }, [onboardingScope]);

  function dismiss() {
    writeHostOnboardingState(onboardingScope, { welcomeDismissed: true });
    setWasRestarted(false);
  }

  if (!isVisible) {
    return null;
  }

  return (
    <section
      aria-labelledby="host-welcome-title"
      className="mt-4 rounded-md border border-teal-200 bg-teal-50 p-5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <div className="hidden size-10 shrink-0 items-center justify-center rounded-full bg-white text-teal-700 ring-1 ring-teal-200 sm:flex">
            <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8.25 9a3.75 3.75 0 1 1 6.33 2.72c-1.19 1.1-2.58 1.65-2.58 3.03" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-950" id="host-welcome-title">
              Welcome to Ed.ie
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-700">
              A hosted space is the long-lived home for a class or teaching
              team. Inside it, sessions collect live prompts, responses,
              questions, and polls.
            </p>
            <p className="mt-2 text-sm font-medium text-teal-900">
              {hasSpaces
                ? "Choose a hosted space below, then open or create a session. We will guide you through the dashboard when it opens."
                : "You do not have a hosted space yet. Ask an Ed.ie administrator to create one, or ask a space owner to invite you."}
            </p>
          </div>
        </div>
        <button
          aria-label="Dismiss welcome guide"
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-teal-200 bg-white text-slate-600 transition hover:border-teal-500 hover:text-teal-800"
          type="button"
          onClick={dismiss}
        >
          <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          className="h-10 rounded-md bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
          type="button"
          onClick={dismiss}
        >
          Got it
        </button>
      </div>
    </section>
  );
}
