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
    <div className="fixed right-3 top-3 z-50" ref={containerRef}>
      <button
        aria-label="Settings"
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-slate-500 shadow-sm transition hover:border-teal-500 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-teal-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        ⚙
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <p className="mb-2 border-b border-slate-100 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Settings
          </p>
          <ThemeSelector />
        </div>
      ) : null}
    </div>
  );
}
