import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HelpArticleMarkdown } from "@/components/HelpArticleMarkdown";
import { getAllHelpArticles, getHelpArticle } from "@/lib/help-content";

export function generateStaticParams() {
  return getAllHelpArticles().map((article) => ({ slug: article.slug }));
}

export async function generateMetadata(
  props: PageProps<"/help/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = getHelpArticle(slug);

  if (!article) return {};

  return {
    title: `${article.title} | Ed.ie Help Centre`,
    description: article.summary,
  };
}

export default async function HelpArticlePage(props: PageProps<"/help/[slug]">) {
  const { slug } = await props.params;
  const article = getHelpArticle(slug);

  if (!article) notFound();

  const reviewed = new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${article.reviewed}T00:00:00Z`));

  return (
    <article className="min-w-0 rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <Link className="inline-flex items-center gap-2 text-sm font-semibold text-teal-700 hover:text-teal-900 lg:hidden" href="/help">
        <span aria-hidden="true">←</span> All guides
      </Link>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-teal-700 lg:mt-0">
        {article.category}
      </p>
      <h2 className="mt-2 text-3xl font-semibold tracking-normal text-slate-950 sm:text-4xl">
        {article.title}
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
        {article.summary}
      </p>
      <p className="mt-4 text-xs font-medium text-slate-500">
        Reviewed {reviewed} · Current Ed.ie interface
      </p>

      <div className="mt-8 space-y-7">
        <HelpArticleMarkdown>{article.content}</HelpArticleMarkdown>
      </div>
    </article>
  );
}
