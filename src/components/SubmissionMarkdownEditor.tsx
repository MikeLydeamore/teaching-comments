"use client";

import dynamic from "next/dynamic";
import { useRef, useState, type KeyboardEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import type { RefMDEditor } from "@uiw/react-md-editor/nohighlight";
import {
  bold,
  checkedListCommand,
  code,
  codeBlock,
  divider,
  image,
  italic,
  link,
  orderedListCommand,
  quote,
  strikethrough,
  unorderedListCommand,
  type ICommand,
} from "@uiw/react-md-editor/commands";
import { SubmissionMarkdown } from "@/components/SubmissionMarkdown";
import { canReplaceMarkdownSelection } from "@/lib/submission-markdown-editor";

const MarkdownEditor = dynamic(
  () => import("@uiw/react-md-editor/nohighlight"),
  { ssr: false },
);

const EmojiPicker = dynamic(() => import("emoji-picker-react"), {
  ssr: false,
});

type EditorMode = "write" | "preview";

type SubmissionMarkdownEditorProps = {
  ariaLabel?: string;
  disabled?: boolean;
  id: string;
  imageEmbedsEnabled?: boolean;
  maxLength: number;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  value: string;
};

function createEditorCommands(
  emojiCommand: ICommand,
  imageEmbedsEnabled: boolean,
): ICommand[] {
  return [
    bold,
    italic,
    strikethrough,
    divider,
    unorderedListCommand,
    orderedListCommand,
    checkedListCommand,
    quote,
    divider,
    code,
    codeBlock,
    link,
    ...(imageEmbedsEnabled ? [image] : []),
    emojiCommand,
  ];
}

export function SubmissionMarkdownEditor({
  ariaLabel = "Your writing",
  disabled = false,
  id,
  imageEmbedsEnabled = true,
  maxLength,
  onChange,
  onKeyDown,
  placeholder = "Type your response here...",
  value,
}: SubmissionMarkdownEditorProps) {
  const [mode, setMode] = useState<EditorMode>("write");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const editorRef = useRef<RefMDEditor>(null);
  const emojiCommand: ICommand = {
    name: "emoji",
    keyCommand: "emoji",
    render: (_command, commandDisabled) => (
      <Popover.Trigger asChild>
        <button
          aria-label="Insert emoji"
          disabled={disabled || commandDisabled}
          title="Insert emoji"
          type="button"
        >
          <span className="text-sm leading-none">☺</span>
        </button>
      </Popover.Trigger>
    ),
  };

  return (
    <Popover.Root open={emojiOpen} onOpenChange={setEmojiOpen}>
      <div className="mt-3 overflow-hidden rounded-md border border-slate-300 bg-white">
        <div
          aria-label="Writing mode"
          className="flex border-b border-slate-200 bg-slate-50 px-2 pt-2"
          role="tablist"
        >
          {(["write", "preview"] as const).map((tab) => (
            <button
              aria-controls={`${id}-panel`}
              aria-selected={mode === tab}
              className={`rounded-t-md border px-4 py-2 text-sm font-semibold capitalize transition ${
                mode === tab
                  ? "-mb-px border-slate-300 border-b-white bg-white text-slate-950"
                  : "border-transparent text-slate-600 hover:text-slate-950"
              }`}
              id={`${id}-${tab}-tab`}
              key={tab}
              role="tab"
              type="button"
              onClick={() => {
                setEmojiOpen(false);
                setMode(tab);
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div
          aria-labelledby={`${id}-${mode}-tab`}
          id={`${id}-panel`}
          role="tabpanel"
        >
          <MarkdownEditor
            autoFocus={false}
            className="edie-submission-editor"
            commands={createEditorCommands(emojiCommand, imageEmbedsEnabled)}
            data-color-mode="light"
            extraCommands={[]}
            height={240}
            preview={mode === "write" ? "edit" : "preview"}
            ref={editorRef}
            textareaProps={{
              "aria-label": ariaLabel,
              disabled,
              id,
              maxLength,
              onKeyDown,
              placeholder,
            }}
            value={value}
            visibleDragbar={false}
            components={{
              preview: (source) =>
                source.trim() ? (
                  <SubmissionMarkdown
                    className="min-h-40 p-[10px] text-lg leading-7 text-slate-950"
                    imageEmbedsEnabled={imageEmbedsEnabled}
                  >
                    {source}
                  </SubmissionMarkdown>
                ) : (
                  <p className="min-h-40 p-[10px] text-sm text-slate-500">
                    Nothing to preview yet.
                  </p>
                ),
            }}
            onChange={(nextValue = "") => {
              if (nextValue.length <= maxLength) {
                onChange(nextValue);
              }
            }}
          />
        </div>
      </div>

      <Popover.Portal>
        <Popover.Content
          align="end"
          className="edie-emoji-popover"
          collisionPadding={12}
          sideOffset={6}
        >
          <EmojiPicker
            autoFocusSearch
            height={360}
            previewConfig={{ showPreview: false }}
            width="min(22rem, calc(100vw - 1.5rem))"
            onEmojiClick={(emoji) => {
              const orchestrator = editorRef.current?.commandOrchestrator;
              const state = orchestrator?.getState();

              if (
                state &&
                canReplaceMarkdownSelection(
                  state.text,
                  state.selectedText,
                  emoji.emoji,
                  maxLength,
                )
              ) {
                orchestrator?.textApi.replaceSelection(emoji.emoji);
              }

              setEmojiOpen(false);
            }}
          />
          <Popover.Arrow className="fill-slate-300" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
