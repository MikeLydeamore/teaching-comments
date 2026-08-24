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
  /** Extra nav entries rendered under the standard account navigation. */
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
    <div className="fixed right-4 top-4 z-50" ref={containerRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-teal-50 text-sm font-bold text-teal-900 shadow-md ring-1 ring-slate-300 transition hover:ring-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-100"
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
        <div className="absolute right-0 mt-2 w-72 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl" role="menu">
          <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-teal-50 text-sm font-bold text-teal-900 ring-1 ring-teal-200">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="h-full w-full object-cover" src={user.image} />
              ) : (
                initials || "?"
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-950">
                {user.name}
              </p>
              <p className="truncate text-xs text-slate-500">{user.email}</p>
            </div>
          </div>
          <nav className="p-2">
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              href="/host"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <svg aria-hidden="true" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5 12 3l9 7.5M5.25 9.75V21h13.5V9.75M9 21v-6h6v6" />
              </svg>
              Your spaces
            </Link>
            <Link
              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
              href="/host/invitations"
              onClick={() => setOpen(false)}
              role="menuitem"
            >
              <svg aria-hidden="true" className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5A2.25 2.25 0 0 1 19.5 19.5h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0-8.659 5.197a2.25 2.25 0 0 1-2.182 0L2.25 6.75" />
              </svg>
              Invitations
            </Link>
            {children}
          </nav>
          <div className="border-y border-slate-100 bg-slate-50 px-4 py-3">
            <ThemeSelector />
          </div>
          <form action={logoutTeacher} className="p-2">
            <input name="next" type="hidden" value="/auth/login" />
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-semibold text-red-700 transition hover:bg-red-50"
              role="menuitem"
              type="submit"
            >
              <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
