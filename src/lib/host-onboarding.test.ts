import { describe, expect, it } from "vitest";
import {
  defaultHostOnboardingState,
  hostOnboardingStorageKey,
  parseHostOnboardingState,
} from "./host-onboarding";

describe("host onboarding state", () => {
  it("scopes persisted progress to a teacher", () => {
    expect(hostOnboardingStorageKey("teacher-123")).toBe(
      "edie_host_onboarding:v1:teacher-123",
    );
  });

  it("uses defaults for missing or invalid state", () => {
    expect(parseHostOnboardingState(null)).toEqual(defaultHostOnboardingState);
    expect(parseHostOnboardingState("not json")).toEqual(
      defaultHostOnboardingState,
    );
  });

  it("accepts only supported persisted values", () => {
    expect(
      parseHostOnboardingState(
        JSON.stringify({
          checklistDismissed: true,
          qrOpened: "yes",
          roomControlsOpened: true,
          sessionTourStatus: "unexpected",
          welcomeDismissed: true,
        }),
      ),
    ).toEqual({
      checklistDismissed: true,
      qrOpened: false,
      roomControlsOpened: true,
      sessionTourStatus: "not-started",
      welcomeDismissed: true,
    });
  });
});
