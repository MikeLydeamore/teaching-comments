import type { ComponentProps } from "react";
import Markdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

type SubmissionMarkdownProps = {
  children: string;
  className?: string;
  imageEmbedsEnabled?: boolean;
};

const allowedElements = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "img",
  "input",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "ul",
];

function safeMarkdownUrl(url: string, key: string) {
  try {
    const parsed = new URL(url);

    if (key === "src") {
      return parsed.protocol === "https:" ? parsed.href : "";
    }

    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed.href
      : "";
  } catch {
    return "";
  }
}

function MarkdownLink({ href, children, ...props }: ComponentProps<"a">) {
  if (!href) {
    return <>{children}</>;
  }

  return (
    <a
      {...props}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

function MarkdownImage({ alt, src, ...props }: ComponentProps<"img">) {
  if (typeof src !== "string" || !src) {
    return alt ? <span>{alt}</span> : null;
  }

  return (
    // Remote Markdown images intentionally bypass Next Image's host allowlist.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt ?? ""}
      decoding="async"
      loading="lazy"
      referrerPolicy="no-referrer"
      src={src}
    />
  );
}

function MarkdownImageLink({ alt, src }: ComponentProps<"img">) {
  if (typeof src !== "string" || !src) {
    return alt ? <span>{alt}</span> : null;
  }

  return (
    <a href={src} rel="noopener noreferrer" target="_blank">
      {alt || "View image"}
    </a>
  );
}

export function SubmissionMarkdown({
  children,
  className = "",
  imageEmbedsEnabled = true,
}: SubmissionMarkdownProps) {
  return (
    <div className={`edie-markdown ${className}`}>
      <Markdown
        allowedElements={allowedElements}
        components={{
          a: MarkdownLink,
          img: imageEmbedsEnabled ? MarkdownImage : MarkdownImageLink,
        }}
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkBreaks]}
        skipHtml
        unwrapDisallowed
        urlTransform={safeMarkdownUrl}
      >
        {children}
      </Markdown>
    </div>
  );
}
