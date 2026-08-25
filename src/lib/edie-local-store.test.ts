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
