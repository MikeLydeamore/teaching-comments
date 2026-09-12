"use client";

import { InlineCodeText } from "./InlineCodeText";

type PollResultOptionProps = {
  animate?: boolean;
  isCorrect: boolean;
  label: string;
  maxResponseCount: number;
  responseCount: number;
  size?: "compact" | "popout";
};

export function PollResultOption({
  animate = false,
  isCorrect,
  label,
  maxResponseCount,
  responseCount,
  size = "compact",
}: PollResultOptionProps) {
  const isPopout = size === "popout";

  return (
    <div
      className={`rounded-md p-2 ${
        isCorrect
          ? isPopout
            ? "bg-green-50 ring-4 ring-green-600 ring-offset-2"
            : "bg-green-50 ring-2 ring-green-600 ring-offset-2"
          : ""
      }`}
    >
      <div
        className={
          isPopout
            ? "flex items-end justify-between gap-5"
            : "flex items-end justify-between gap-4 text-sm"
        }
      >
        <p
          className={
            isPopout
              ? "min-w-0 break-words text-2xl font-semibold sm:text-3xl"
              : "min-w-0 break-words font-medium text-slate-800"
          }
        >
          {isCorrect ? <span className="sr-only">Correct answer: </span> : null}
          <InlineCodeText>{label}</InlineCodeText>
        </p>
        <p
          className={
            isPopout
              ? "shrink-0 text-3xl font-semibold tabular-nums text-slate-700 sm:text-4xl"
              : "shrink-0 font-semibold tabular-nums text-slate-700"
          }
        >
          {responseCount}
        </p>
      </div>
      <div
        className={
          isPopout
            ? "mt-3 h-8 overflow-hidden rounded bg-white shadow-inner sm:h-10"
            : "mt-1 h-4 overflow-hidden rounded bg-slate-100"
        }
      >
        <div
          className={`h-full rounded bg-teal-600${
            animate
              ? isPopout
                ? " transition-[width] duration-300"
                : " transition-[width]"
              : ""
          }`}
          style={{
            width: `${(responseCount / maxResponseCount) * 100}%`,
          }}
        />
      </div>
    </div>
  );
}
