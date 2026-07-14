"use client";

import type { MouseEvent, ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";

type HomeNavCardProps = {
  children: ReactNode;
  href: string;
  kicker: string;
  pendingLabel: string;
  title: string;
};

export function HomeNavCard({
  children,
  href,
  kicker,
  pendingLabel,
  title,
}: HomeNavCardProps) {
  const [isPending, setIsPending] = useState(false);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return;
    }

    setIsPending(true);
  }

  return (
    <Link
      aria-busy={isPending}
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-500 hover:shadow-md"
      href={href}
      onClick={handleClick}
    >
      <p className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
        {kicker}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">{children}</p>
      <p
        aria-live="polite"
        className="mt-4 text-sm font-semibold text-teal-700"
      >
        {isPending ? pendingLabel : "Open"}
      </p>
    </Link>
  );
}
