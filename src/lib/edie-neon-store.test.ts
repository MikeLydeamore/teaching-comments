import { beforeEach, describe, expect, it, vi } from "vitest";

const { neonMock, queryMock } = vi.hoisted(() => ({
  neonMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@neondatabase/serverless", () => ({ neon: neonMock }));

import { neonStore } from "./edie-neon-store";
import { selectedStorageBackend } from "./edie-storage-backend";
import { QuestionBankConflictError } from "./edie-store-model";
import { collectNeonReferences } from "../../tools/reconcile-images.mjs";

const imageData = {
  version: 1 as const,
  objectKey: `committed/${"A".repeat(43)}/123e4567-e89b-42d3-a456-426614174000.png`,
  contentType: "image/png" as const,
  byteSize: 42,
  etag: "image-etag",
};
const sessionRow = {
  id: "demo-lecture", code: "demo-lecture", space_code: "default",
  title: "Demo", prompt: "A valid prompt.", is_open: true,
  group_questions_screening_enabled: false, submissions_screening_enabled: false,
  text_input_enabled: true, gif_input_enabled: true, drawing_input_enabled: true,
  image_input_enabled: true, created_at: new Date("2026-01-02T03:04:05.000Z"),
  prompt_updated_at: new Date("2026-01-02T03:04:05.000Z"),
  timer_duration_seconds: 0, timer_ends_at: null,
};
const pollRow = {
  id: "123e4567-e89b-42d3-a456-426614174001", session_code: "demo-lecture",
  question: "Which answer is correct?", selection_mode: "single",
  options: [
    { id: "option-a", label: "A", position: 0 },
    { id: "option-b", label: "B", position: 1 },
  ],
  correct_option_ids: ["option-b"], solution_revealed: true, status: "active",
  duration_seconds: 60, started_at: new Date("2026-01-02T03:04:05.000Z"),
  ends_at: new Date("2026-01-02T03:05:05.000Z"), ended_at: null,
  created_at: new Date("2026-01-02T03:04:05.000Z"),
  updated_at: new Date("2026-01-02T03:04:06.000Z"),
};
const submissionViewSettingsRow = {
  session_code: "demo-lecture",
  prompt_history_id: null,
  minutes: 3,
  sort_order: "newest",
  starred_only: false,
  revision: 2,
  updated_at: new Date("2026-01-02T03:04:07.000Z"),
};

function submissionRow(values: unknown[]) {
  return {
    id: "123e4567-e89b-42d3-a456-426614174000", session_code: "demo-lecture",
    student_name: "Anonymous", text: String(values[3] ?? ""),
    drawing_data: values[4] ? JSON.parse(String(values[4])) : null,
    gif_data: values[5] ? JSON.parse(String(values[5])) : null,
    image_data: values[6] ? JSON.parse(String(values[6])) : null,
    status: values[7], starred: false, flagged: false, version: 1, archived_at: null,
    created_at: new Date("2026-01-02T03:04:06.000Z"),
    updated_at: new Date("2026-01-02T03:04:06.000Z"),
  };
}

beforeEach(() => {
  process.env.DATABASE_URL = "postgresql://test.invalid/test";
  neonMock.mockReset();
  queryMock.mockReset();
  neonMock.mockReturnValue({ query: queryMock });
  queryMock.mockImplementation(async (statement: string, values: unknown[] = []) => {
    if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) return [sessionRow];
    if (statement.startsWith("INSERT INTO edie_submissions")) return [submissionRow(values)];
    return [];
  });
});

describe("Neon submission serialization", () => {
  const cases = [
    ["text", { text: "A text response." }, [null, null, null]],
    ["drawing", { text: "", drawingData: { version: 1, width: 400, height: 300, strokes: [{ color: "#123456", size: 3, points: [{ x: 1, y: 2 }] }] } }, ["drawing", null, null]],
    ["GIF", { text: "", gifData: { id: "gif-1", title: "GIF", url: "https://giphy.com/media/gif-1", previewUrl: "https://giphy.com/media/gif-1", giphyUrl: "https://giphy.com/gifs/gif-1", width: 100, height: 100 } }, [null, "gif", null]],
    ["image", { text: "", imageData }, [null, null, "image"]],
  ] as const;

  it.each(cases)("binds %s-only media as SQL JSONB or NULL", async (_kind, input, expected) => {
    const result = await neonStore.addSubmission("demo-lecture", input);
    const insertCall = queryMock.mock.calls.find(([statement]) => String(statement).startsWith("INSERT INTO edie_submissions"));
    expect(insertCall).toBeTruthy();
    const values = insertCall?.[1] as unknown[];
    const expectedMedia = [
      "drawingData" in input ? input.drawingData : null,
      "gifData" in input ? input.gifData : null,
      "imageData" in input ? input.imageData : null,
    ];

    for (const [index, kind] of expected.entries()) {
      const bound = values[index + 4];
      if (kind === null) expect(bound).toBeNull();
      else expect(JSON.parse(String(bound))).toEqual(expectedMedia[index]);
    }
    expect(result.drawingData).toEqual(expectedMedia[0]);
    expect(result.gifData).toEqual(expectedMedia[1]);
    expect(result.imageData).toEqual(expectedMedia[2]);
    expect(result.createdAt).toBe("2026-01-02T03:04:06.000Z");
    expect(result.updatedAt).toBe("2026-01-02T03:04:06.000Z");
  });
});

describe("Neon submission view settings", () => {
  it("maps a persisted settings row", async () => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) {
        return [sessionRow];
      }
      if (statement.includes("FROM edie_submission_view_settings")) {
        return [submissionViewSettingsRow];
      }
      return [];
    });

    await expect(
      neonStore.getSubmissionViewSettings("demo-lecture"),
    ).resolves.toEqual({
      sessionCode: "demo-lecture",
      promptHistoryId: null,
      minutes: 3,
      sortOrder: "newest",
      starredOnly: false,
      revision: 2,
      updatedAt: "2026-01-02T03:04:07.000Z",
    });
  });

  it("uses an atomic partial upsert and increments the revision", async () => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) {
        return [sessionRow];
      }
      if (statement.startsWith("INSERT INTO edie_submission_view_settings")) {
        return [{
          ...submissionViewSettingsRow,
          minutes: 10,
          revision: 3,
        }];
      }
      return [];
    });

    await expect(
      neonStore.updateSubmissionViewSettings("demo-lecture", { minutes: 10 }),
    ).resolves.toMatchObject({ minutes: 10, revision: 3 });

    const upsert = queryMock.mock.calls.find(([statement]) =>
      String(statement).startsWith("INSERT INTO edie_submission_view_settings"),
    );
    expect(upsert?.[0]).toContain("current_settings.revision + 1");
    expect(upsert?.[1]?.slice(6)).toEqual([false, true, false, false]);
  });

  it("rejects a prompt filter from another session", async () => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) {
        return [sessionRow];
      }
      return [];
    });

    await expect(
      neonStore.updateSubmissionViewSettings("demo-lecture", {
        promptHistoryId: "123e4567-e89b-42d3-a456-426614174099",
      }),
    ).rejects.toThrow("Prompt filter does not belong to this session.");
  });
});

describe("Neon poll solutions", () => {
  it("maps persisted solution fields", async () => {
    queryMock.mockResolvedValueOnce([pollRow]);

    await expect(neonStore.getPoll(pollRow.id)).resolves.toMatchObject({
      correctOptionIds: ["option-b"],
      solutionRevealed: true,
    });
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("correct_option_ids, solution_revealed"),
      [pollRow.id],
    );
  });

  it("converts correct option indexes to generated option IDs", async () => {
    queryMock.mockImplementation(async (statement: string, values: unknown[] = []) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) return [sessionRow];
      if (statement.startsWith("WITH ended")) {
        const options = JSON.parse(String(values[4]));
        return [{
          ...pollRow,
          question: values[2], selection_mode: values[3], options,
          correct_option_ids: JSON.parse(String(values[5])), solution_revealed: false,
          duration_seconds: values[6], started_at: values[1], ends_at: values[7],
          created_at: values[1], updated_at: values[1],
        }];
      }
      return [];
    });

    const poll = await neonStore.startPoll(
      "demo-lecture",
      "Which answer is correct?",
      "single",
      ["A", "B"],
      [1],
      60,
    );

    expect(poll?.correctOptionIds).toEqual([poll?.options[1].id]);
    expect(poll?.solutionRevealed).toBe(false);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("correct_option_ids,solution_revealed"),
      expect.any(Array),
    );
  });
});

it("maps PostgreSQL duplicate-key errors to status 409", async () => {
  queryMock.mockImplementationOnce(async () => [sessionRow]);
  queryMock.mockRejectedValueOnce(Object.assign(new Error("duplicate key"), { code: "23505" }));

  try {
    await neonStore.addSubmission("demo-lecture", { text: "Duplicate." });
    throw new Error("expected duplicate-key error");
  } catch (error) {
    expect(error).toMatchObject({ name: "NeonStoreError", status: 409 });
    expect(error).toHaveProperty("message", "duplicate key");
  }
});

describe("Neon question bank uniqueness", () => {
  it("returns a friendly conflict for a duplicate question", async () => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) {
        return [sessionRow];
      }
      if (statement.startsWith("INSERT INTO edie_question_bank")) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      return [];
    });

    await expect(
      neonStore.addQuestionToBank(
        "demo-lecture",
        "What does this result mean?",
        "Interpretation",
      ),
    ).rejects.toEqual(
      new QuestionBankConflictError("That question is already in the bank."),
    );
  });

  it("returns a friendly conflict for a duplicate poll question", async () => {
    queryMock.mockImplementation(async (statement: string) => {
      if (statement.startsWith("SELECT") && statement.includes("edie_sessions")) {
        return [sessionRow];
      }
      if (statement.startsWith("INSERT INTO edie_poll_question_bank")) {
        throw Object.assign(new Error("duplicate key"), { code: "23505" });
      }
      return [];
    });

    await expect(
      neonStore.addPollQuestionToBank(
        "demo-lecture",
        "Interpretation",
        "Which interpretation is correct?",
        "single",
        ["A", "B"],
        [0],
      ),
    ).rejects.toEqual(
      new QuestionBankConflictError(
        "That poll question is already in the bank.",
      ),
    );
  });
});

it("scans Neon image references through a mocked SQL client", async () => {
  const query = vi.fn().mockResolvedValue([{ image_data: imageData }]);
  const references = await collectNeonReferences("postgresql://test.invalid/test", () => ({ query }) as never);
  expect(query).toHaveBeenCalledWith("SELECT image_data FROM edie_submissions WHERE image_data IS NOT NULL ORDER BY id ASC");
  expect(references).toHaveLength(1);
  expect(references[0].objectKey).toBe(imageData.objectKey);
});

it("uses explicit backend requests before safe implicit precedence", () => {
  expect(selectedStorageBackend({ EDIE_STORAGE_BACKEND: "local", DATABASE_URL: "postgresql://x" })).toBe("local");
  expect(selectedStorageBackend({ EDIE_STORAGE_BACKEND: "neon" })).toBe("neon");
  expect(selectedStorageBackend({ DATABASE_URL: "postgresql://x" })).toBe("neon");
  expect(selectedStorageBackend({})).toBe("local");
});
