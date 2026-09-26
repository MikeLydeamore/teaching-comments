import type { Metadata } from "next";
import Link from "next/link";
import { HelpNavigation } from "@/components/HelpNavigation";
import { HelpScrollGuard } from "@/components/HelpScrollGuard";
import { getHelpArticleIndex } from "@/lib/help-content";

export const metadata: Metadata = {
  title: "Help centre | Ed.ie",
  description: "Guides for running and joining Ed.ie classroom sessions.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const articles = getHelpArticleIndex();

  return (
    <main className="min-h-screen bg-slate-100 px-5 py-8">
      <HelpScrollGuard />
      <div className="mx-auto max-w-6xl">
        <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">
          <Link className="hover:text-teal-800" href="/">
            Ed.ie
          </Link>
          <svg aria-hidden="true" className="size-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <Link className="text-slate-700 hover:text-teal-800" href="/help">
            Help centre
          </Link>
        </nav>

        <header className="rounded-md border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-teal-700">
            Ed.ie help centre
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-normal text-slate-950">
            What would you like to do?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Find practical guides for preparing a session, teaching live, or taking part.
          </p>
        </header>

        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <HelpNavigation articles={articles} />
          {children}
        </div>
      </div>
    </main>
  );
}
