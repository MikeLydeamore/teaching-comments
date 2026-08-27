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
      starredOnly: false,
      revision: 0,
    });
  });

  it("serializes partial updates without losing independent fields", async () => {
    await Promise.all([
      localStore.updateSubmissionViewSettings("demo-lecture", { minutes: 10 }),
      localStore.updateSubmissionViewSettings("demo-lecture", {
        starredOnly: true,
      }),
    ]);

    await expect(
      localStore.getSubmissionViewSettings("demo-lecture"),
    ).resolves.toMatchObject({ minutes: 10, starredOnly: true, revision: 2 });
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
});
