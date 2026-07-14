"use client";

import type { AnchorHTMLAttributes, MouseEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";

type PendingLinkProps = Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  "children" | "href"
> & {
  children: ReactNode;
  href: string;
  pendingChildren?: ReactNode;
  pendingStatusText?: string;
  statusClassName?: string;
  statusText?: string;
};

export function PendingLink({
  children,
  onClick,
  pendingChildren,
  pendingStatusText,
  statusClassName = "",
  statusText,
  target,
  ...linkProps
}: PendingLinkProps) {
  const [isPending, setIsPending] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      (target && target !== "_self")
    ) {
      return;
    }

    setIsPending(true);
  }

  return (
    <Link
      {...linkProps}
      aria-busy={isPending}
      onClick={handleClick}
      target={target}
    >
      {isPending && pendingChildren ? pendingChildren : children}
      {statusText || pendingStatusText ? (
        <span aria-live="polite" className={statusClassName}>
          {isPending ? (pendingStatusText ?? statusText) : statusText}
        </span>
      ) : null}
    </Link>
  );
}
