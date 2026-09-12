import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PollResults, SessionPoll } from "../lib/edie-store";
import {
  SubmissionsPollOverlay,
  submissionsPollIsVisible,
} from "./SubmissionsPollOverlay";

const poll: SessionPoll = {
  id: "poll-1",
  sessionCode: "session-1",
  question: "Which answer is correct?",
  selectionMode: "single",
  options: [
    { id: "option-1", label: "A", position: 0 },
    { id: "option-2", label: "`B`", position: 1 },
  ],
  correctOptionIds: ["option-2"],
  solutionRevealed: true,
  status: "active",
  durationSeconds: 60,
  startedAt: "2026-09-12T11:00:00.000Z",
  endsAt: "2026-09-12T11:01:00.000Z",
  votingEndedAt: null,
  endedAt: null,
  createdAt: "2026-09-12T11:00:00.000Z",
  updatedAt: "2026-09-12T11:00:00.000Z",
};

const results: PollResults = {
  poll,
  responseCount: 1,
  options: [
    { ...poll.options[0], responseCount: 0 },
    { ...poll.options[1], responseCount: 1 },
  ],
};

describe("SubmissionsPollOverlay", () => {
  it("keeps the poll visible after its timer expires", () => {
    expect(
      submissionsPollIsVisible({
        ...poll,
        endsAt: "2020-01-01T00:00:00.000Z",
      }),
    ).toBe(true);
  });

  it("shows active poll results over the submissions popout", () => {
    const output = renderToStaticMarkup(
      <SubmissionsPollOverlay
        initialPoll={poll}
        initialResults={results}
        sessionCode="session-1"
      />,
    );

    expect(output).toContain('role="dialog"');
    expect(output).toContain("Which answer is correct?");
    expect(output).toContain("1 response");
    expect(output).toContain("Correct answer:");
  });

  it("stays hidden after the teacher closes the poll", () => {
    const endedPoll = { ...poll, status: "ended" as const };
    const output = renderToStaticMarkup(
      <SubmissionsPollOverlay
        initialPoll={endedPoll}
        initialResults={{ ...results, poll: endedPoll }}
        sessionCode="session-1"
      />,
    );

    expect(output).toBe("");
  });
});
