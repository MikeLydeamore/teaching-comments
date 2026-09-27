import type { Metadata } from "next";
import { HelpNavigation } from "@/components/HelpNavigation";
import { HelpScrollGuard } from "@/components/HelpScrollGuard";
import { PublicSiteFooter } from "@/components/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/PublicSiteHeader";
import { getHelpArticleIndex } from "@/lib/help-content";

export const metadata: Metadata = {
  title: "Help centre | Ed.ie",
  description: "Guides for running and joining Ed.ie classroom sessions.",
};

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  const articles = getHelpArticleIndex();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950">
      <HelpScrollGuard />
      <PublicSiteHeader />
      <main>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-5 py-12 sm:py-16">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-teal-700">
              Ed.ie help centre
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
              What would you like to do?
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Find practical guides for preparing a session, teaching live, or
              taking part.
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl items-start gap-4 px-5 py-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:py-12">
          <HelpNavigation articles={articles} />
          {children}
        </div>
      </main>
      <PublicSiteFooter />
    </div>
  );
}
