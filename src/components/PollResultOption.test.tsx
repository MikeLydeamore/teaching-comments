import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PollResultOption } from "./PollResultOption";

describe("PollResultOption", () => {
  it("announces the correct option and renders its inline-code label", () => {
    const output = renderToStaticMarkup(
      <PollResultOption
        isCorrect
        label="`diamonds |> group_by(cut)`"
        maxResponseCount={1}
        responseCount={0}
        size="popout"
      />,
    );

    expect(output).toContain('<span class="sr-only">Correct answer: </span>');
    expect(output).toMatch(
      /<code[^>]*>diamonds \|&gt; group_by\(cut\)<\/code>/,
    );
    expect(output).toContain('role="progressbar"');
    expect(output).toContain('aria-valuenow="0"');
    expect(output).toContain('aria-valuemax="1"');
    expect(output).toContain(
      'aria-label="0 responses for `diamonds |&gt; group_by(cut)`"',
    );
  });

  it("reports an incorrect option's response count without calling it correct", () => {
    const output = renderToStaticMarkup(
      <PollResultOption
        isCorrect={false}
        label="Incorrect"
        maxResponseCount={2}
        responseCount={1}
      />,
    );

    expect(output).not.toContain("Correct answer:");
    expect(output).toContain('role="progressbar"');
    expect(output).toContain('aria-valuenow="1"');
    expect(output).toContain('aria-valuemax="2"');
    expect(output).toContain('aria-label="1 response for Incorrect"');
  });
});
