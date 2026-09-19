import { describe, expect, it } from "vitest";
import {
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateDisplayName,
  validateUsername,
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

describe("validateUsername", () => {
  it("normalizes an optional @ prefix while preserving display case", () => {
    expect(validateUsername("  @Jane_Smith  ")).toEqual({
      ok: true,
      username: "jane_smith",
      displayUsername: "Jane_Smith",
    });
  });

  it.each([undefined, null, "", "@", "  "])("rejects an empty value", (value) => {
    expect(validateUsername(value)).toEqual({
      ok: false,
      message: "Enter a username.",
    });
  });

  it("enforces the username length limits", () => {
    expect(validateUsername("a".repeat(USERNAME_MIN_LENGTH - 1))).toEqual({
      ok: false,
      message: `Usernames must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`,
    });
    expect(validateUsername("a".repeat(USERNAME_MAX_LENGTH + 1))).toEqual({
      ok: false,
      message: `Usernames must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`,
    });
  });

  it.each(["_jane", "jane-smith", "jane.smith", "jane smith"])(
    "rejects unsupported characters in %s",
    (value) => {
      expect(validateUsername(value)).toEqual({
        ok: false,
        message:
          "Use letters, numbers, and underscores, starting with a letter or number.",
      });
    },
  );

  it.each(["admin", "Administrator", "EDIE", "support", "system"])(
    "rejects reserved username %s",
    (value) => {
      expect(validateUsername(value)).toEqual({
        ok: false,
        message: "That username is reserved.",
      });
    },
  );
});
