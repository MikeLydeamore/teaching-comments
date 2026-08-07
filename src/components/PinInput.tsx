"use client";

import { useState, type ComponentProps } from "react";

type PinInputProps = Omit<ComponentProps<"input">, "type"> & {
  wrapperClassName?: string;
};

export function PinInput({
  className = "",
  wrapperClassName = "",
  ...props
}: PinInputProps) {
  const [isVisible, setIsVisible] = useState(false);
  const actionLabel = isVisible ? "Hide PIN" : "Show PIN";

  return (
    <div className={`relative ${wrapperClassName}`}>
      <input
        {...props}
        className={`${className} pr-11`}
        type={isVisible ? "text" : "password"}
      />
      <button
        aria-label={actionLabel}
        aria-pressed={isVisible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600"
        onClick={() => setIsVisible((visible) => !visible)}
        title={actionLabel}
        type="button"
      >
        {isVisible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M2.25 12s3.5-6 9.75-6 9.75 6 9.75 6-3.5 6-9.75 6-9.75-6-9.75-6Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M3 3l18 18M10.6 6.1A10.8 10.8 0 0 1 12 6c6.25 0 9.75 6 9.75 6a16.6 16.6 0 0 1-3 3.7M6.2 6.2C3.65 8 2.25 12 2.25 12s3.5 6 9.75 6c1.3 0 2.5-.26 3.55-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  );
}
