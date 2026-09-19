import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX_LENGTH,
  validateDisplayName,
} from "./user-profile";

describe("validateDisplayName", () => {
  it("trims a valid display name", () => {
    expect(validateDisplayName("  Dr Jane Smith  ")).toEqual({
      ok: true,
      value: "Dr Jane Smith",
    });
  });

  it.each([undefined, null, "", "   "])("rejects an empty value", (value) => {
    expect(validateDisplayName(value)).toEqual({
      ok: false,
      message: "Enter a display name.",
    });
  });

  it("accepts the maximum length", () => {
    const value = "a".repeat(DISPLAY_NAME_MAX_LENGTH);
    expect(validateDisplayName(value)).toEqual({ ok: true, value });
  });

  it("rejects a value over the maximum length", () => {
    expect(validateDisplayName("a".repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      message: `Display names must be ${DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
  });

  it("rejects control characters", () => {
    expect(validateDisplayName("Jane\nSmith")).toEqual({
      ok: false,
      message: "Display names cannot contain line breaks or control characters.",
    });
  });
});
