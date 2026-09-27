import Link from "next/link";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-200 focus-visible:ring-offset-2";

export function PublicSiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-950">Ed.ie</p>
          <p className="mt-1 text-sm text-slate-500">
            Live classroom engagement for every voice.
          </p>
        </div>
        <nav
          aria-label="Footer navigation"
          className="flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-slate-600"
        >
          <Link className={`rounded-sm transition hover:text-teal-800 ${focusRing}`} href="/join">
            Join
          </Link>
          <Link className={`rounded-sm transition hover:text-teal-800 ${focusRing}`} href="/help">
            Help centre
          </Link>
          <Link className={`rounded-sm transition hover:text-teal-800 ${focusRing}`} href="/privacy">
            Privacy
          </Link>
          <Link className={`rounded-sm transition hover:text-teal-800 ${focusRing}`} href="/help/accessibility">
            Accessibility
          </Link>
        </nav>
      </div>
    </footer>
  );
}
