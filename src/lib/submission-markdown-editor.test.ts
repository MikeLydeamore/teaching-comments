import { describe, expect, it } from "vitest";
import {
  canReplaceMarkdownSelection,
  isMarkdownSubmitShortcut,
} from "./submission-markdown-editor";

describe("isMarkdownSubmitShortcut", () => {
  it("accepts Ctrl+Enter and Cmd+Enter", () => {
    expect(
      isMarkdownSubmitShortcut({
        ctrlKey: true,
        isComposing: false,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(true);
    expect(
      isMarkdownSubmitShortcut({
        ctrlKey: false,
        isComposing: false,
        key: "Enter",
        metaKey: true,
      }),
    ).toBe(true);
  });

  it("leaves plain Enter and IME composition alone", () => {
    expect(
      isMarkdownSubmitShortcut({
        ctrlKey: false,
        isComposing: false,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(false);
    expect(
      isMarkdownSubmitShortcut({
        ctrlKey: true,
        isComposing: true,
        key: "Enter",
        metaKey: false,
      }),
    ).toBe(false);
  });
});

describe("canReplaceMarkdownSelection", () => {
  it("accounts for selected text when checking the limit", () => {
    expect(canReplaceMarkdownSelection("12345", "345", "abcdef", 8)).toBe(
      true,
    );
    expect(canReplaceMarkdownSelection("12345", "", "abcdef", 8)).toBe(
      false,
    );
  });

  it("counts emoji the same way as the textarea and store validator", () => {
    expect(canReplaceMarkdownSelection("123", "", "😀", 5)).toBe(true);
    expect(canReplaceMarkdownSelection("1234", "", "😀", 5)).toBe(false);
  });
});
