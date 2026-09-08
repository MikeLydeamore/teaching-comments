type MarkdownShortcutEvent = {
  ctrlKey: boolean;
  isComposing: boolean;
  key: string;
  metaKey: boolean;
};

export function isMarkdownSubmitShortcut(event: MarkdownShortcutEvent) {
  return (
    event.key === "Enter" &&
    (event.ctrlKey || event.metaKey) &&
    !event.isComposing
  );
}

export function canReplaceMarkdownSelection(
  text: string,
  selectedText: string,
  replacement: string,
  maxLength: number,
) {
  return text.length - selectedText.length + replacement.length <= maxLength;
}
