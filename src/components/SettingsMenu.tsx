"use client";

import { useEffect, useRef, useState } from "react";
import { ThemeSelector } from "./ThemeSelector";

/**
 * Student-facing settings entry point: a small cog with non-account options.
 * Students never sign in, so no account entries belong in here.
 */
export function SettingsMenu() {
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
    <div className="fixed right-4 top-4 z-50" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Settings"
        className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-white bg-white text-slate-500 shadow-md ring-1 ring-slate-300 transition hover:text-teal-700 hover:ring-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.6 3.75h4.8l.52 2.1c.38.16.74.37 1.08.62l2.04-.63 2.4 4.16-1.53 1.47a7.6 7.6 0 0 1 0 1.06L20.44 14l-2.4 4.16L16 17.53c-.34.25-.7.46-1.08.62l-.52 2.1H9.6l-.52-2.1A7.2 7.2 0 0 1 8 17.53l-2.04.63L3.56 14l1.53-1.47a7.6 7.6 0 0 1 0-1.06L3.56 10l2.4-4.16L8 6.47c.34-.25.7-.46 1.08-.62l.52-2.1Z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" role="menu">
          <p className="border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Settings
          </p>
          <div className="bg-slate-50 px-4 py-3">
            <ThemeSelector />
          </div>
        </div>
      ) : null}
    </div>
  );
}
