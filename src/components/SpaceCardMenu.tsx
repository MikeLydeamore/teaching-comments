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
        className="flex h-8 w-8 items-center justify-center rounded-md text-lg leading-none text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        ⋮
      </button>
      {open ? (
        <div
          className="absolute right-0 mt-1 w-48 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
          role="menu"
        >
          <Link
            className="block px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
            href={`/host/${spaceCode}/settings`}
            onClick={() => setOpen(false)}
            role="menuitem"
          >
            Manage access
          </Link>
        </div>
      ) : null}
    </div>
  );
}
