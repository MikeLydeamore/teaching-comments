import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:ring-offset-2";

export function PublicSiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
      <nav
        aria-label="Main navigation"
        className="mx-auto grid max-w-7xl items-center gap-4 px-5 py-4 sm:grid-cols-[1fr_auto_1fr]"
      >
        <Link
          className={`inline-flex h-9 w-fit items-center gap-2 rounded-md text-xl font-semibold text-slate-950 ${focusRing}`}
          href="/"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-teal-700 text-base font-bold text-white">
            E
          </span>
          Ed.ie
        </Link>

        <div className="flex h-9 items-center gap-5 text-sm font-semibold text-slate-600 sm:justify-self-center">
          <Link
            className={`inline-flex h-9 items-center rounded-sm transition hover:text-teal-800 ${focusRing}`}
            href="/#features"
          >
            Features
          </Link>
          <Link
            className={`inline-flex h-9 items-center rounded-sm transition hover:text-teal-800 ${focusRing}`}
            href="/#how-it-works"
          >
            How it works
          </Link>
          <Link
            className={`inline-flex h-9 items-center rounded-sm transition hover:text-teal-800 ${focusRing}`}
            href="/help"
          >
            Help
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-self-end">
          <Link
            className={`inline-flex h-9 items-center rounded-md border border-slate-300 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-800 ${focusRing}`}
            href="/join"
          >
            Join a session
          </Link>
          <Link
            className={`inline-flex h-9 items-center rounded-md bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 ${focusRing}`}
            href="/auth/login?returnTo=/host"
          >
            Login
          </Link>
        </div>
      </nav>
    </header>
  );
}
