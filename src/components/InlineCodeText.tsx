import type { ReactNode } from "react";

type InlineCodeTextProps = {
  children: string;
  className?: string;
};

const singleLineFencedCodePattern = /(^|\r?\n)[ \t]*(`{3,})(?!`)([^\r\n]*?)\2[ \t]*(?=\r?\n|$)/g;
const inlineCodePattern = /(`(?:\\`|[^`\r\n])*`)/g;

type FencedCodeMatch = {
  content: string;
  endIndex: number;
  index: number;
  prefix: string;
};

type FenceLine = {
  end: number;
  fence: string;
  index: number;
  lineBreakLength: number;
  prefix: string;
  start: number;
  suffix: string;
};

const fenceLinePattern = /(^|\r?\n)([ \t]*)(`{3,})([^\r\n]*)(?=\r?\n|$)/g;

function findMultilineFencedCodeMatches(text: string): FencedCodeMatch[] {
  const lines: FenceLine[] = Array.from(text.matchAll(fenceLinePattern)).map(
    (match) => {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      const nextCharacters = text.slice(end, end + 2);

      return {
        end,
        fence: match[3],
        index,
        lineBreakLength:
          nextCharacters === "\r\n" ? 2 : nextCharacters.startsWith("\n") ? 1 : 0,
        prefix: match[1],
        start: index + match[1].length,
        suffix: match[4],
      };
    },
  );
  const matches: FencedCodeMatch[] = [];

  for (let openingIndex = 0; openingIndex < lines.length; openingIndex += 1) {
    const opening = lines[openingIndex];

    if (!opening.lineBreakLength) {
      continue;
    }

    const fenceLengths = [opening.fence.length];
    let closing: FenceLine | null = null;

    for (
      let lineIndex = openingIndex + 1;
      lineIndex < lines.length;
      lineIndex += 1
    ) {
      const line = lines[lineIndex];
      const currentFenceLength = fenceLengths[fenceLengths.length - 1];

      if (line.fence.length !== currentFenceLength) {
        continue;
      }

      if (line.suffix.trim()) {
        fenceLengths.push(line.fence.length);
        continue;
      }

      fenceLengths.pop();

      if (!fenceLengths.length) {
        closing = line;
        break;
      }
    }

    if (!closing) {
      continue;
    }

    const body = text.slice(opening.end + opening.lineBreakLength, closing.index);
    const content = `${opening.suffix}${opening.suffix && body ? "\n" : ""}${body}`;

    matches.push({
      content,
      endIndex: closing.end,
      index: opening.index,
      prefix: opening.prefix,
    });
  }

  return matches;
}

function findFencedCodeMatches(text: string) {
  return [
    ...findMultilineFencedCodeMatches(text),
    ...Array.from(text.matchAll(singleLineFencedCodePattern)).map((match) => ({
      content: match[3],
      endIndex: (match.index ?? 0) + match[0].length,
      index: match.index ?? 0,
      prefix: match[1],
    })),
  ].sort((left, right) => left.index - right.index);
}

function renderInlineCode(text: string, keyPrefix: string, className: string) {
  return text.split(inlineCodePattern).map((part, index) => {
    if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          className={`qwt-inline-code rounded px-1 py-0.5 font-mono text-[0.9em] font-medium ${className}`}
          key={`${keyPrefix}-${index}`}
        >
          {part.slice(1, -1).replaceAll("\\`", "`")}
        </code>
      );
    }

    return part;
  });
}

export function InlineCodeText({ children, className = "" }: InlineCodeTextProps) {
  const rendered: ReactNode[] = [];
  let lastIndex = 0;
  let blockIndex = 0;

  for (const fencedMatch of findFencedCodeMatches(children)) {
    const { content, endIndex, index: matchIndex, prefix } = fencedMatch;

    if (matchIndex < lastIndex) {
      continue;
    }

    rendered.push(
      ...renderInlineCode(
        children.slice(lastIndex, matchIndex),
        `inline-${blockIndex}`,
        className,
      ),
    );

    if (prefix) {
      rendered.push(prefix);
    }

    rendered.push(
      <code
        className={`qwt-code-block font-mono text-[0.9em] font-medium ${className}`}
        key={`block-${blockIndex}`}
      >
        {content}
      </code>,
    );

    lastIndex = endIndex;
    blockIndex += 1;
  }

  rendered.push(
    ...renderInlineCode(
      children.slice(lastIndex),
      `inline-${blockIndex}`,
      className,
    ),
  );

  return <>{rendered}</>;
}
