"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { HelpArticleIndexItem, HelpAudience } from "@/lib/help-content";

const audienceLabels: Record<HelpAudience | "all", string> = {
  all: "All",
  everyone: "General",
  host: "Hosts",
  participant: "Participants",
};

function normaliseSearch(value: string) {
  const aliases: Record<string, string> = {
    student: "participant",
    students: "participant",
    teacher: "host",
    teachers: "host",
    submission: "response",
    submissions: "response",
  };

  return value
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => aliases[term] ?? term);
}

export function HelpNavigation({ articles }: { articles: HelpArticleIndexItem[] }) {
  const pathname = usePathname();
  const [audience, setAudience] = useState<HelpAudience | "all">("all");
  const [query, setQuery] = useState("");
  const terms = normaliseSearch(query);

  const filteredArticles = useMemo(
    () =>
      articles.filter((article) => {
        const audienceMatches =
          audience === "all" ||
          article.audience === audience ||
          article.audience === "everyone";
        const searchable = `${article.title} ${article.summary} ${article.category} ${article.searchText}`.toLowerCase();
        return audienceMatches && terms.every((term) => searchable.includes(term));
      }),
    [articles, audience, terms],
  );

  const categories = [...new Set(filteredArticles.map((article) => article.category))];

  function navigationContents(searchId: string) {
    return <>
      <label className="text-sm font-semibold text-slate-700" htmlFor={searchId}>
        Search the help centre
      </label>
      <div className="relative mt-2">
        <svg aria-hidden="true" className="absolute left-3 top-3.5 size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" strokeLinecap="round" />
        </svg>
        <input
          className="h-11 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none focus:border-teal-600 focus:ring-4 focus:ring-teal-100"
          id={searchId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Try “students cannot join”"
          type="search"
          value={query}
        />
      </div>

      <div aria-label="Filter guides by audience" className="mt-3 grid grid-cols-3 gap-1 rounded-md bg-slate-100 p-1">
        {(["all", "host", "participant"] as const).map((value) => (
          <button
            aria-pressed={audience === value}
            className={`rounded px-2 py-2 text-xs font-semibold transition ${
              audience === value
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-teal-800"
            }`}
            key={value}
            onClick={() => setAudience(value)}
            type="button"
          >
            {audienceLabels[value]}
          </button>
        ))}
      </div>

      <nav aria-label="Help centre guides" className="mt-4">
        {categories.map((category) => (
          <div className="mb-5 last:mb-0" key={category}>
            <p className="px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              {category}
            </p>
            <ul className="mt-1 space-y-0.5">
              {filteredArticles
                .filter((article) => article.category === category)
                .map((article) => {
                  const href = `/help/${article.slug}`;
                  const isCurrent = pathname === href;
                  const matchingSections = terms.length
                    ? article.sections.filter((section) => {
                        const searchable = `${section.title} ${section.searchText}`.toLowerCase();
                        return terms.every((term) => searchable.includes(term));
                      })
                    : [];

                  return (
                    <li key={article.slug}>
                      <Link
                        aria-current={isCurrent ? "page" : undefined}
                        className={`block rounded-md px-2 py-2 text-sm font-semibold leading-5 transition ${
                          isCurrent
                            ? "bg-teal-50 text-teal-900"
                            : "text-slate-700 hover:bg-slate-50 hover:text-teal-800"
                        }`}
                        href={href}
                      >
                        {article.title}
                      </Link>
                      {matchingSections.length ? (
                        <ul className="mb-2 ml-3 border-l border-slate-200 pl-2">
                          {matchingSections.slice(0, 3).map((section) => (
                            <li key={section.id}>
                              <Link
                                className="block rounded px-2 py-1 text-xs text-slate-500 hover:text-teal-800"
                                href={`${href}#${section.id}`}
                              >
                                {section.title}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
        {!filteredArticles.length ? (
          <p className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-600">
            No guides match that search. Try fewer words or a different audience.
          </p>
        ) : null}
      </nav>
    </>;
  }

  return (
    <>
      <aside className="rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:hidden">
        {pathname === "/help" ? navigationContents("help-search-mobile") : (
          <details>
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-slate-800">
              Find another guide
              <svg aria-hidden="true" className="size-4 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </summary>
            <div className="mt-4 border-t border-slate-200 pt-4">
              {navigationContents("help-search-mobile")}
            </div>
          </details>
        )}
      </aside>
      <aside className="sticky top-5 hidden max-h-[calc(100vh-2.5rem)] overflow-y-auto rounded-md border border-slate-200 bg-white p-4 shadow-sm lg:block">
        {navigationContents("help-search-desktop")}
      </aside>
    </>
  );
}
