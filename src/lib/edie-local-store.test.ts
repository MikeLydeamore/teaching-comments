import { beforeEach, describe, expect, it, vi } from "vitest";

const { memory, mkdirMock, readFileMock, writeFileMock } = vi.hoisted(() => ({
  memory: { value: undefined as string | undefined },
  mkdirMock: vi.fn(),
  readFileMock: vi.fn(),
  writeFileMock: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  mkdir: mkdirMock,
  readFile: readFileMock,
  writeFile: writeFileMock,
}));

import { localStore } from "./edie-local-store";

beforeEach(() => {
  memory.value = undefined;
  mkdirMock.mockReset();
  readFileMock.mockReset();
  writeFileMock.mockReset();
  readFileMock.mockImplementation(async () => {
    if (memory.value === undefined) {
      throw Object.assign(new Error("missing"), { code: "ENOENT" });
    }
    return memory.value;
  });
  writeFileMock.mockImplementation(async (_path, value) => {
    memory.value = String(value);
  });
});

describe("local question bank uniqueness", () => {
  it("serializes concurrent duplicate question additions", async () => {
    const results = await Promise.allSettled([
      localStore.addQuestionToBank(
        "demo-lecture",
        "What does this result mean?",
        "First title",
      ),
      localStore.addQuestionToBank(
        "demo-lecture",
        "  WHAT DOES THIS RESULT MEAN?  ",
        "Second title",
      ),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    await expect(localStore.listQuestionBank("demo-lecture")).resolves.toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      reason: {
        message: "That question is already in the bank.",
        status: 409,
      },
    });
  });

  it("serializes concurrent duplicate poll-question additions", async () => {
    const results = await Promise.allSettled([
      localStore.addPollQuestionToBank(
        "demo-lecture",
        "First title",
        "Which interpretation is correct?",
        "single",
        ["A", "B"],
        [0],
      ),
      localStore.addPollQuestionToBank(
        "demo-lecture",
        "Second title",
        " WHICH INTERPRETATION IS CORRECT? ",
        "single",
        ["A", "B"],
        [0],
      ),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      "fulfilled",
      "rejected",
    ]);
    await expect(
      localStore.listPollQuestionBank("demo-lecture"),
    ).resolves.toHaveLength(1);
    const rejection = results.find((result) => result.status === "rejected");
    expect(rejection).toMatchObject({
      reason: {
        message: "That poll question is already in the bank.",
        status: 409,
      },
    });
  });
});

describe("local hosted-space management", () => {
  it("renames a space without changing its code", async () => {
    await localStore.createTeacherSpaceForOwner(
      "stats-101",
      "Statistics",
      { userId: "owner-1", name: "Owner" },
    );

    await expect(
      localStore.renameTeacherSpace("stats-101", "Applied statistics"),
    ).resolves.toMatchObject({
      code: "stats-101",
      name: "Applied statistics",
    });
  });

  it("hides a deleted space, restores it, and only purges it after retention", async () => {
    await localStore.createTeacherSpaceForOwner(
      "stats-101",
      "Statistics",
      { userId: "owner-1", name: "Owner" },
    );
    const session = await localStore.getOrCreateSessionInSpace("stats-101", "week-1");
    await localStore.addSubmission(session!.id, { text: "A response" });

    await expect(
      localStore.softDeleteTeacherSpace("stats-101", "2026-01-01T00:00:00.000Z"),
    ).resolves.toMatchObject({
      code: "stats-101",
      deletedAt: "2026-01-01T00:00:00.000Z",
      purgeAfter: "2026-01-31T00:00:00.000Z",
    });
    await expect(localStore.getTeacherSpace("stats-101")).resolves.toBeNull();
    await expect(localStore.getSessionInSpace("stats-101", "week-1")).resolves.toBeNull();
    await expect(localStore.listDeletedTeacherSpaces()).resolves.toHaveLength(1);

    await expect(localStore.restoreTeacherSpace("stats-101")).resolves.toMatchObject({
      deletedAt: null,
      purgeAfter: null,
    });
    await expect(localStore.getTeacherSpace("stats-101")).resolves.not.toBeNull();
    await expect(localStore.listSubmissions(session!.id)).resolves.toHaveLength(1);

    await localStore.softDeleteTeacherSpace("stats-101", "2026-01-01T00:00:00.000Z");
    await expect(
      localStore.purgeDeletedTeacherSpaces("2026-01-30T23:59:59.000Z"),
    ).resolves.toBe(0);
    await expect(
      localStore.purgeDeletedTeacherSpaces("2026-01-31T00:00:00.000Z"),
    ).resolves.toBe(1);
    await expect(localStore.listDeletedTeacherSpaces()).resolves.toEqual([]);
    await expect(localStore.listSubmissions(session!.id)).resolves.toEqual([]);
    await expect(localStore.listSpaceMembers("stats-101")).resolves.toEqual([]);
  });

  it("protects the built-in default space", async () => {
    await expect(localStore.softDeleteTeacherSpace("default")).resolves.toBeNull();
    await expect(localStore.getTeacherSpace("default")).resolves.not.toBeNull();
  });
});

describe("local poll presentation lifecycle", () => {
  it("ends voting before closing the poll", async () => {
    const poll = await localStore.startPoll(
      "demo-lecture",
      "Which answer is correct?",
      "single",
      ["A", "B"],
      [0],
      60,
    );

    expect(poll).not.toBeNull();
    const scheduledEndsAt = poll!.endsAt;
    const finished = await localStore.finishPoll(poll!.id);
    expect(finished).toMatchObject({
      status: "active",
      endedAt: null,
      votingEndedAt: expect.any(String),
    });
    expect(finished?.endsAt).toBe(scheduledEndsAt);

    const closed = await localStore.endPoll(poll!.id);
    expect(closed).toMatchObject({ status: "ended" });
    expect(closed?.endedAt).not.toBeNull();
  });
});

describe("local submission view settings", () => {
  it("loads defaults when a legacy JSON store has no settings collection", async () => {
    await localStore.getSession("demo-lecture");
    const legacy = JSON.parse(memory.value ?? "{}") as Record<string, unknown>;
    delete legacy.submissionViewSettings;
    memory.value = JSON.stringify(legacy);

    await expect(
      localStore.getSubmissionViewSettings("demo-lecture"),
    ).resolves.toMatchObject({
      promptHistoryId: null,
      minutes: 3,
      sortOrder: "newest",
      revision: 0,
    });
  });

  it("serializes partial updates without losing independent fields", async () => {
    const [submission] = await localStore.listSubmissions("demo-lecture");

    await Promise.all([
      localStore.updateSubmissionViewSettings("demo-lecture", { minutes: 10 }),
      localStore.updateSubmissionViewSettings("demo-lecture", {
        sortOrder: "oldest",
      }),
      localStore.updateSubmissionViewSettings("demo-lecture", {
        expandedSubmissionId: submission.id,
      }),
    ]);

    await expect(
      localStore.getSubmissionViewSettings("demo-lecture"),
    ).resolves.toMatchObject({
      expandedSubmissionId: submission.id,
      minutes: 10,
      sortOrder: "oldest",
      revision: 3,
    });
  });

  it("rejects a prompt filter from another session", async () => {
    const [prompt] = await localStore.listPromptHistory("demo-lecture");
    const otherSession = await localStore.getOrCreateSessionInSpace(
      "default",
      "other-room",
    );

    await expect(
      localStore.updateSubmissionViewSettings(otherSession!.id, {
        promptHistoryId: prompt.id,
      }),
    ).rejects.toThrow("Prompt filter does not belong to this session.");
  });

  it("rejects an expanded submission from another session", async () => {
    const [submission] = await localStore.listSubmissions("demo-lecture");
    const otherSession = await localStore.getOrCreateSessionInSpace(
      "default",
      "other-room",
    );

    await expect(
      localStore.updateSubmissionViewSettings(otherSession!.id, {
        expandedSubmissionId: submission.id,
      }),
    ).rejects.toThrow("Expanded submission does not belong to this session.");
  });
});

describe("local session image embeds", () => {
  it("defaults legacy sessions on and persists updates", async () => {
    await localStore.getSession("demo-lecture");
    const legacy = JSON.parse(memory.value ?? "{}") as {
      sessions: Array<Record<string, unknown>>;
    };
    delete legacy.sessions[0].imageEmbedsEnabled;
    memory.value = JSON.stringify(legacy);

    await expect(localStore.getSession("demo-lecture")).resolves.toMatchObject({
      imageEmbedsEnabled: true,
    });
    await localStore.updateSession("demo-lecture", {
      imageEmbedsEnabled: false,
    });
    await expect(localStore.getSession("demo-lecture")).resolves.toMatchObject({
      imageEmbedsEnabled: false,
      imageInputEnabled: true,
    });
  });
});
