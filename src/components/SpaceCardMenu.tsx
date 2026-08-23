"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * Per-card context menu for secondary space actions, kept visually separate
 * from the card's primary navigation click target.
 */
export function SpaceCardMenu({
  spaceCode,
  spaceName,
}: {
  spaceCode: string;
  spaceName: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div className="absolute right-2 top-2 z-10" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Actions for ${spaceName}`}
        className="flex h-8 w-8 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.7" />
          <circle cx="12" cy="12" r="1.7" />
          <circle cx="12" cy="19" r="1.7" />
        </svg>
      </button>
      {open ? (
        <div
          className="absolute right-0 mt-1 w-48 overflow-hidden rounded-lg border border-slate-200 bg-white py-1.5 shadow-xl"
          role="menu"
        >
          <Link
            className="flex items-center gap-2.5 px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
            href={`/host/${spaceCode}/settings`}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            <svg aria-hidden="true" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.1a7.5 7.5 0 0 1 15 0M18.75 8.25v4.5M21 10.5h-4.5" />
            </svg>
            Manage access
          </Link>
        </div>
      ) : null}
    </div>
  );
}
