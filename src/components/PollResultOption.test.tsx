import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PollResultOption } from "./PollResultOption";

describe("PollResultOption", () => {
  it("outlines the complete correct option when its label is inline code", () => {
    const output = renderToStaticMarkup(
      <PollResultOption
        isCorrect
        label="`diamonds |> group_by(cut)`"
        maxResponseCount={1}
        responseCount={0}
        size="popout"
      />,
    );

    expect(output).toMatch(
      /^<div class="rounded-md p-2 bg-green-50 ring-4 ring-green-600/,
    );
    expect(output).toContain('<span class="sr-only">Correct answer: </span>');
    expect(output).toContain('<code class="edie-inline-code');
    expect(output).toContain("diamonds |&gt; group_by(cut)");
  });

  it("does not mark an incorrect option", () => {
    const output = renderToStaticMarkup(
      <PollResultOption
        isCorrect={false}
        label="Incorrect"
        maxResponseCount={2}
        responseCount={1}
      />,
    );

    expect(output).not.toContain("ring-green-600");
    expect(output).toMatch(/^<div class="rounded-md p-2 "/);
    expect(output).not.toContain("Correct answer:");
    expect(output).toContain("width:50%");
  });
});
