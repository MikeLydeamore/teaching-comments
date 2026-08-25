"use client";

import type { KeyboardEvent } from "react";
import {
  parseTimerDurationInput,
  sanitizeTimerDraftValue,
} from "@/lib/timer-duration";

type TimerDurationInputProps = {
  id: string;
  value: string;
  onValueChange: (value: string) => void;
  onCommit: (seconds: number | null) => void;
  onSubmit?: () => void;
};

export function TimerDurationInput({
  id,
  value,
  onValueChange,
  onCommit,
  onSubmit,
}: TimerDurationInputProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" && onSubmit) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <input
      id={id}
      className="h-10 w-24 rounded-md border border-slate-300 px-3 font-mono tabular-nums text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
      inputMode="numeric"
      placeholder="0:30"
      type="text"
      value={value}
      onBlur={() => onCommit(parseTimerDurationInput(value))}
      onChange={(event) =>
        onValueChange(sanitizeTimerDraftValue(event.target.value))
      }
      onKeyDown={handleKeyDown}
    />
  );
}
