import { describe, expect, it } from "vitest";
import {
  defaultSubmissionViewSettings,
  normalizeSubmissionViewSettingsPatch,
} from "./edie-store-model";

describe("submission view settings", () => {
  it("uses the dashboard's existing defaults", () => {
    expect(
      defaultSubmissionViewSettings(
        "session-1",
        "2026-01-02T03:04:05.000Z",
      ),
    ).toEqual({
      sessionCode: "session-1",
      promptHistoryId: null,
      minutes: 3,
      sortOrder: "newest",
      starredOnly: false,
      revision: 0,
      updatedAt: "2026-01-02T03:04:05.000Z",
    });
  });

  it.each([0, 1, 3, 5, 10])("accepts a %s-minute time range", (minutes) => {
    expect(normalizeSubmissionViewSettingsPatch({ minutes })).toEqual({
      minutes,
    });
  });

  it("accepts each supported partial field", () => {
    expect(
      normalizeSubmissionViewSettingsPatch({
        promptHistoryId: null,
        sortOrder: "oldest",
        starredOnly: true,
      }),
    ).toEqual({
      promptHistoryId: null,
      sortOrder: "oldest",
      starredOnly: true,
    });
  });

  it.each([
    null,
    {},
    { minutes: 2 },
    { sortOrder: "manual" },
    { starredOnly: "yes" },
    { promptHistoryId: "" },
    { revision: 4 },
  ])("rejects invalid settings: %j", (value) => {
    expect(() => normalizeSubmissionViewSettingsPatch(value)).toThrow();
  });
});
