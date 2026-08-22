"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type PendingActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean;
  pendingChildren?: ReactNode;
};

export function PendingActionButton({
  children,
  className = "",
  disabled,
  pending = false,
  pendingChildren,
  type = "button",
  ...buttonProps
}: PendingActionButtonProps) {
  const isDisabled = disabled || pending;

  return (
    <button
      {...buttonProps}
      aria-busy={pending || undefined}
      className={`${className} ${pending ? "cursor-wait opacity-70" : ""}`}
      disabled={isDisabled}
      type={type}
    >
      <span className="inline-flex items-center justify-center gap-2">
        {pending ? (
          <>
            <span
              aria-hidden="true"
              className="size-3 rounded-full border-2 border-current border-r-transparent animate-spin"
            />
            {pendingChildren !== undefined ? pendingChildren : children}
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}
