import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SubmissionMarkdown } from "./SubmissionMarkdown";

function render(markdown: string, imageEmbedsEnabled = true) {
  return renderToStaticMarkup(
    <SubmissionMarkdown imageEmbedsEnabled={imageEmbedsEnabled}>
      {markdown}
    </SubmissionMarkdown>,
  );
}

describe("SubmissionMarkdown", () => {
  it("renders the supported Markdown features", () => {
    const output = render(
      "**bold** *italic* ~~deleted~~\n\n> quote\n\n- item\n- [x] task\n\n`inline`\n\n```js\nconst value = 1;\n```",
    );

    expect(output).toContain("<strong>bold</strong>");
    expect(output).toContain("<em>italic</em>");
    expect(output).toContain("<del>deleted</del>");
    expect(output).toContain("<blockquote>");
    expect(output).toContain("<ul");
    expect(output).toContain('type="checkbox"');
    expect(output).toContain("<code>inline</code>");
    expect(output).toContain('<code class="language-js">');
  });

  it("does not render headings, tables, or raw HTML elements", () => {
    const output = render(
      "# Heading\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n<script>alert(1)</script>",
    );

    expect(output).not.toContain("<h1");
    expect(output).not.toContain("<table");
    expect(output).not.toContain("<script");
    expect(output).toContain("Heading");
  });

  it("allows HTTP links and HTTPS images with safe attributes", () => {
    const output = render(
      "[Example](http://example.com) ![Diagram](https://images.example.com/a.png)",
    );

    expect(output).toContain('href="http://example.com/"');
    expect(output).toContain('rel="noopener noreferrer"');
    expect(output).toContain('target="_blank"');
    expect(output).toContain('src="https://images.example.com/a.png"');
    expect(output).toContain('loading="lazy"');
    expect(output).toContain('referrerPolicy="no-referrer"');
  });

  it("turns unsafe links and non-HTTPS images into plain alt text", () => {
    const output = render(
      "[unsafe](javascript:alert(1)) ![insecure](http://example.com/a.png) ![data](data:image/png;base64,abc)",
    );

    expect(output).not.toContain("javascript:");
    expect(output).not.toContain("data:image");
    expect(output).not.toContain("<img");
    expect(output).toContain("unsafe");
    expect(output).toContain("insecure");
    expect(output).toContain("data");
  });

  it("turns HTTPS images into links when image embeds are disabled", () => {
    const output = render(
      "Before ![Diagram](https://images.example.com/a.png) after",
      false,
    );

    expect(output).not.toContain("<img");
    expect(output).toContain('href="https://images.example.com/a.png"');
    expect(output).toContain(">Diagram</a>");
  });
});
