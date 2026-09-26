import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { helpHeadingId } from "@/lib/help-content";

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(textFromChildren).join("");
  }
  if (children && typeof children === "object" && "props" in children) {
    return textFromChildren((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

function HelpLink({ href = "", children, ...props }: ComponentProps<"a">) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return (
      <Link {...props} className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4 hover:text-teal-900" href={href}>
        {children}
      </Link>
    );
  }
  return (
    <a {...props} className="font-semibold text-teal-700 underline decoration-teal-300 underline-offset-4 hover:text-teal-900" href={href} rel="noopener noreferrer" target="_blank">
      {children}
    </a>
  );
}

export function HelpArticleMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      components={{
        a: HelpLink,
        blockquote: ({ children }) => <blockquote className="my-5 border-l-4 border-teal-300 bg-teal-50 px-4 py-3 text-slate-700">{children}</blockquote>,
        code: ({ children }) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[0.9em] font-semibold text-slate-800">{children}</code>,
        h2: ({ children }) => {
          const id = helpHeadingId(textFromChildren(children));
          return <h2 className="scroll-mt-5 border-t border-slate-200 pt-7 text-2xl font-semibold text-slate-950 first:border-0 first:pt-0" id={id}>{children}</h2>;
        },
        h3: ({ children }) => <h3 className="mt-6 text-lg font-semibold text-slate-950">{children}</h3>,
        li: ({ children }) => <li className="pl-1">{children}</li>,
        ol: ({ children }) => <ol className="my-4 list-decimal space-y-2 pl-6 text-slate-700">{children}</ol>,
        p: ({ children }) => <p className="my-3 leading-7 text-slate-700">{children}</p>,
        table: ({ children }) => <div className="my-5 overflow-x-auto rounded-md border border-slate-200"><table className="w-full border-collapse text-left text-sm">{children}</table></div>,
        td: ({ children }) => <td className="border-t border-slate-200 px-3 py-3 align-top text-slate-700">{children}</td>,
        th: ({ children }) => <th className="bg-slate-50 px-3 py-3 font-semibold text-slate-900">{children}</th>,
        ul: ({ children }) => <ul className="my-4 list-disc space-y-2 pl-6 text-slate-700">{children}</ul>,
      }}
      rehypePlugins={[rehypeSanitize]}
      remarkPlugins={[remarkGfm]}
      skipHtml
    >
      {children}
    </Markdown>
  );
}
