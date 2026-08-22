"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { logoutTeacher } from "@/app/host/actions";
import { ThemeSelector } from "./ThemeSelector";

export type AccountMenuUser = {
  name: string;
  email: string;
  image: string | null;
};

export function AccountMenu({
  children,
  user,
}: {
  /** Extra nav entries rendered under "Your spaces" (future options). */
  children?: React.ReactNode;
  user: AccountMenuUser;
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

  const initials = (user.name || user.email)
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");

  return (
    <div className="fixed right-3 top-3 z-50" ref={containerRef}>
      <button
        aria-label="Account menu"
        className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-700 shadow-sm transition hover:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="h-full w-full object-cover"
            src={user.image}
          />
        ) : (
          initials || "?"
        )}
      </button>

      {open ? (
        <div className="absolute right-0 mt-2 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
          <div className="border-b border-slate-100 pb-3">
            <p className="truncate text-sm font-semibold text-slate-950">
              {user.name}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <nav className="pt-2">
            <Link
              className="block rounded-md px-2 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              href="/host"
              onClick={() => setOpen(false)}
            >
              Your spaces
            </Link>
            {children}
          </nav>
          <div className="border-t border-slate-100 px-2 py-3">
            <ThemeSelector />
          </div>
          <form action={logoutTeacher} className="border-t border-slate-100 pt-2">
            <input name="next" type="hidden" value="/auth/login" />
            <button
              className="w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-red-700 hover:bg-red-50"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
