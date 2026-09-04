import { describe, expect, it } from "vitest";
import { applySessionPatch, type Session } from "./edie-store-model";

const blankSession: Session = {
  id: "blank-session",
  code: "blank-session",
  spaceCode: "default",
  title: "Blank session",
  prompt: "",
  isOpen: true,
  groupQuestionsScreeningEnabled: false,
  submissionsScreeningEnabled: false,
  textInputEnabled: true,
  gifInputEnabled: true,
  drawingInputEnabled: true,
  imageInputEnabled: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  promptUpdatedAt: "2026-01-01T00:00:00.000Z",
  timerDurationSeconds: 0,
  timerEndsAt: null,
};

describe("applySessionPatch", () => {
  it("allows non-prompt updates while the initial prompt is blank", () => {
    const updated = applySessionPatch(blankSession, { isOpen: false });

    expect(updated.isOpen).toBe(false);
    expect(updated.prompt).toBe("");
  });

  it("still rejects an explicitly supplied short prompt", () => {
    expect(() => applySessionPatch(blankSession, { prompt: "No" })).toThrow(
      "Prompt must be at least 5 characters.",
    );
  });
});
