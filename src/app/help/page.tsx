import Link from "next/link";
import { getHelpArticleIndex } from "@/lib/help-content";

const audienceLabel = {
  everyone: "For everyone",
  host: "For hosts",
  participant: "For participants",
};

export default function HelpCentrePage() {
  const articles = getHelpArticleIndex();
  const categories = [...new Set(articles.map((article) => article.category))];

  return (
    <section className="rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="max-w-2xl">
        <p className="text-sm font-medium uppercase tracking-[0.15em] text-teal-700">
          Browse guides
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-950">
          Start with the task in front of you
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Each guide brings a complete workflow together. Use the search to find a specific control, question, or problem.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {categories.map((category) => (
          <section aria-labelledby={`category-${category.replaceAll(" ", "-").toLowerCase()}`} key={category}>
            <h3 className="text-lg font-semibold text-slate-950" id={`category-${category.replaceAll(" ", "-").toLowerCase()}`}>
              {category}
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {articles
                .filter((article) => article.category === category)
                .map((article) => (
                  <Link
                    className="group rounded-md border border-slate-200 p-4 transition hover:border-teal-500 hover:bg-teal-50"
                    href={`/help/${article.slug}`}
                    key={article.slug}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                      {audienceLabel[article.audience]}
                    </span>
                    <span className="mt-2 block font-semibold text-slate-950 group-hover:text-teal-900">
                      {article.title}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-slate-600">
                      {article.summary}
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
