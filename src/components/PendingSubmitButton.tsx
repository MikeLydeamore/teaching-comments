"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";

type PendingSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  pendingChildren?: ReactNode;
};

export function PendingSubmitButton({
  children,
  className = "",
  disabled,
  pendingChildren = "Working...",
  type = "submit",
  ...buttonProps
}: PendingSubmitButtonProps) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;

  return (
    <button
      {...buttonProps}
      aria-busy={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
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
            {pendingChildren}
          </>
        ) : (
          children
        )}
      </span>
    </button>
  );
}
