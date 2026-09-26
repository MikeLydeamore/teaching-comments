import "server-only";

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

export type HelpAudience = "everyone" | "host" | "participant";

export type HelpSection = {
  id: string;
  title: string;
  searchText: string;
};

export type HelpArticle = {
  audience: HelpAudience;
  category: string;
  content: string;
  order: number;
  reviewed: string;
  sections: HelpSection[];
  slug: string;
  summary: string;
  title: string;
};

export type HelpArticleIndexItem = Omit<HelpArticle, "content"> & {
  searchText: string;
};

const helpDirectory = join(process.cwd(), "content", "help");

function plainText(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/[>*_~|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function helpHeadingId(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function parseHelpArticle(slug: string, source: string): HelpArticle {
  const parsed = matter(source);
  const content = parsed.content.trim();
  const { data } = parsed;
  const audience = data.audience as HelpAudience;
  const reviewed =
    data.reviewed instanceof Date
      ? data.reviewed.toISOString().slice(0, 10)
      : data.reviewed;

  if (
    typeof data.title !== "string" ||
    typeof data.summary !== "string" ||
    typeof data.category !== "string" ||
    typeof reviewed !== "string"
  ) {
    throw new Error(`Help article ${slug} is missing required front matter.`);
  }
  if (!["everyone", "host", "participant"].includes(audience)) {
    throw new Error(`Help article ${slug} has an invalid audience.`);
  }

  const headings = [...content.matchAll(/^##\s+(.+)$/gm)];
  const sections = headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? content.length;
    return {
      id: helpHeadingId(heading[1]),
      title: heading[1].trim(),
      searchText: plainText(content.slice(start, end)).toLowerCase(),
    };
  });

  return {
    audience,
    category: data.category,
    content,
    order:
      typeof data.order === "number"
        ? data.order
        : Number.parseInt(data.order ?? "999", 10),
    reviewed,
    sections,
    slug,
    summary: data.summary,
    title: data.title,
  };
}

export function getAllHelpArticles() {
  return readdirSync(helpDirectory)
    .filter((fileName) => fileName.endsWith(".md"))
    .map((fileName) => {
      const slug = fileName.slice(0, -3);
      return parseHelpArticle(
        slug,
        readFileSync(join(helpDirectory, fileName), "utf8"),
      );
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

export function getHelpArticle(slug: string) {
  return getAllHelpArticles().find((article) => article.slug === slug) ?? null;
}

export function getHelpArticleIndex(): HelpArticleIndexItem[] {
  return getAllHelpArticles().map(({ content, ...article }) => ({
    ...article,
    searchText: plainText(content).toLowerCase(),
  }));
}
