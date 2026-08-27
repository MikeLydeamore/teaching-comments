import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSubmissionViewSettingsMock,
  listPromptHistoryMock,
  listSubmissionsMock,
} = vi.hoisted(() => ({
  getSubmissionViewSettingsMock: vi.fn(),
  listPromptHistoryMock: vi.fn(),
  listSubmissionsMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/edie-store", () => ({
  getSubmissionViewSettings: getSubmissionViewSettingsMock,
  listPromptHistory: listPromptHistoryMock,
  listSubmissions: listSubmissionsMock,
  toSubmissionDto: (submission: unknown) => submission,
}));

import { getSubmissionViewPayload } from "./submission-view";

const session = {
  id: "session-1",
  code: "room-1",
  spaceCode: "default",
  title: "Room 1",
  prompt: "Current prompt text",
  isOpen: true,
  groupQuestionsScreeningEnabled: false,
  submissionsScreeningEnabled: false,
  textInputEnabled: true,
  gifInputEnabled: true,
  drawingInputEnabled: true,
  imageInputEnabled: true,
  createdAt: "2026-01-02T03:00:00.000Z",
  promptUpdatedAt: "2026-01-02T03:00:00.000Z",
  timerDurationSeconds: 0,
  timerEndsAt: null,
};

function submission(id: string, createdAt: string, starred: boolean) {
  return {
    id,
    sessionCode: session.id,
    studentName: "Anonymous",
    text: id,
    drawingData: null,
    gifData: null,
    imageData: null,
    status: "visible",
    starred,
    flagged: false,
    version: 1,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  };
}

beforeEach(() => {
  getSubmissionViewSettingsMock.mockReset();
  listPromptHistoryMock.mockReset();
  listSubmissionsMock.mockReset();
});

describe("getSubmissionViewPayload", () => {
  it("uses canonical filters and returns sorted starred submissions", async () => {
    getSubmissionViewSettingsMock.mockResolvedValue({
      sessionCode: session.id,
      promptHistoryId: "prompt-1",
      minutes: 10,
      sortOrder: "oldest",
      starredOnly: true,
      revision: 4,
      updatedAt: "2026-01-02T03:04:00.000Z",
    });
    listPromptHistoryMock.mockResolvedValue([
      {
        id: "prompt-1",
        sessionCode: session.id,
        prompt: "Earlier prompt",
        startedAt: "2026-01-02T03:00:00.000Z",
        endedAt: null,
      },
    ]);
    listSubmissionsMock.mockResolvedValue([
      submission("new", "2026-01-02T03:03:00.000Z", true),
      submission("not-starred", "2026-01-02T03:02:00.000Z", false),
      submission("old", "2026-01-02T03:01:00.000Z", true),
    ]);

    const result = await getSubmissionViewPayload(session, false);

    expect(listSubmissionsMock).toHaveBeenCalledWith(session.id, {
      includeHidden: false,
      minutes: 10,
      promptHistoryId: "prompt-1",
    });
    expect(result.promptText).toBe("Earlier prompt");
    expect(result.submissions.map(({ id }) => id)).toEqual(["old", "new"]);
  });
});
