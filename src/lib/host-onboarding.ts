export const HOST_ONBOARDING_EVENT = "edie:host-onboarding-start";
export const HOST_ONBOARDING_STATE_EVENT = "edie:host-onboarding-change";

export type HostOnboardingTour = "poll" | "session" | "welcome";

export type HostOnboardingState = {
  checklistDismissed: boolean;
  qrOpened: boolean;
  roomControlsOpened: boolean;
  sessionTourStatus: "completed" | "not-started" | "skipped";
  welcomeDismissed: boolean;
};

export const defaultHostOnboardingState: HostOnboardingState = {
  checklistDismissed: false,
  qrOpened: false,
  roomControlsOpened: false,
  sessionTourStatus: "not-started",
  welcomeDismissed: false,
};

export const hostOnboardingServerSnapshot = JSON.stringify({
  ...defaultHostOnboardingState,
  checklistDismissed: true,
  sessionTourStatus: "completed",
  welcomeDismissed: true,
} satisfies HostOnboardingState);

export function hostOnboardingStorageKey(scope: string) {
  return `edie_host_onboarding:v1:${scope}`;
}

export function parseHostOnboardingState(value: string | null): HostOnboardingState {
  if (!value) {
    return defaultHostOnboardingState;
  }

  try {
    const parsed = JSON.parse(value) as Partial<HostOnboardingState>;

    return {
      checklistDismissed: parsed.checklistDismissed === true,
      qrOpened: parsed.qrOpened === true,
      roomControlsOpened: parsed.roomControlsOpened === true,
      sessionTourStatus:
        parsed.sessionTourStatus === "completed" ||
        parsed.sessionTourStatus === "skipped"
          ? parsed.sessionTourStatus
          : "not-started",
      welcomeDismissed: parsed.welcomeDismissed === true,
    };
  } catch {
    return defaultHostOnboardingState;
  }
}

export function readHostOnboardingState(scope: string) {
  return parseHostOnboardingState(
    window.localStorage.getItem(hostOnboardingStorageKey(scope)),
  );
}

export function getHostOnboardingSnapshot(scope: string) {
  return window.localStorage.getItem(hostOnboardingStorageKey(scope)) ?? "";
}

export function subscribeToHostOnboarding(
  scope: string,
  onStoreChange: () => void,
) {
  function handleStorage(event: StorageEvent) {
    if (event.key === hostOnboardingStorageKey(scope)) {
      onStoreChange();
    }
  }

  function handleLocalChange(event: Event) {
    if ((event as CustomEvent<string>).detail === scope) {
      onStoreChange();
    }
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(HOST_ONBOARDING_STATE_EVENT, handleLocalChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(HOST_ONBOARDING_STATE_EVENT, handleLocalChange);
  };
}

export function writeHostOnboardingState(
  scope: string,
  patch: Partial<HostOnboardingState>,
) {
  const nextState = {
    ...readHostOnboardingState(scope),
    ...patch,
  };

  window.localStorage.setItem(
    hostOnboardingStorageKey(scope),
    JSON.stringify(nextState),
  );
  window.dispatchEvent(
    new CustomEvent<string>(HOST_ONBOARDING_STATE_EVENT, { detail: scope }),
  );

  return nextState;
}

export function startHostOnboardingTour(tour: HostOnboardingTour) {
  window.dispatchEvent(
    new CustomEvent<HostOnboardingTour>(HOST_ONBOARDING_EVENT, {
      detail: tour,
    }),
  );
}
