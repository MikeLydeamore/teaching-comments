import { describe, expect, it } from "vitest";
import { comparePromptRevisions } from "./prompt-sync";

describe("comparePromptRevisions", () => {
  it("recognises the same revision", () => {
    expect(
      comparePromptRevisions(
        "2026-08-26T01:00:00.000Z",
        "2026-08-26T01:00:00.000Z",
      ),
    ).toBe("same");
  });

  it("recognises newer and older revisions", () => {
    expect(
      comparePromptRevisions(
        "2026-08-26T01:00:00.000Z",
        "2026-08-26T01:00:01.000Z",
      ),
    ).toBe("newer");
    expect(
      comparePromptRevisions(
        "2026-08-26T01:00:01.000Z",
        "2026-08-26T01:00:00.000Z",
      ),
    ).toBe("older");
  });

  it("treats a changed unparseable revision as new", () => {
    expect(comparePromptRevisions("legacy-a", "legacy-b")).toBe("newer");
  });
});
