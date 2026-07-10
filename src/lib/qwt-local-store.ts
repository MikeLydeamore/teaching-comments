import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PROMPT,
  applySessionPatch,
  assertSubmissionHasContent,
  calculateStats,
  normalizeSessionCode,
  normalizeStudentName,
  normalizeSubmissionPatch,
  now,
  titleFromCode,
  validateGroupQuestionText,
  validateGroupQuestionVoterId,
  validateQuestionTitle,
  validateSubmissionContent,
  validateQuestionText,
  type GroupQuestion,
  type PromptHistoryItem,
  type QuestionBankItem,
  type QwtStore,
  type Session,
  type Submission,
} from "./qwt-store-model";

type StoreData = {
  groupQuestions: StoredGroupQuestion[];
  promptHistory: PromptHistoryItem[];
  questionBank: QuestionBankItem[];
  sessions: Session[];
  submissions: Submission[];
};

type StoredGroupQuestion = Omit<GroupQuestion, "hasVoted" | "voteCount"> & {
  voterIds: string[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "qwt-store.json");

function defaultStore(): StoreData {
  const createdAt = now();
  const promptHistoryId = randomUUID();

  return {
    groupQuestions: [],
    promptHistory: [
      {
        id: promptHistoryId,
        sessionCode: "demo-lecture",
        prompt: DEFAULT_PROMPT,
        startedAt: createdAt,
        endedAt: null,
      },
    ],
    questionBank: [],
    sessions: [
      {
        code: "demo-lecture",
        title: "Demo Lecture",
        prompt: DEFAULT_PROMPT,
        isOpen: true,
        createdAt,
        promptUpdatedAt: createdAt,
        timerDurationSeconds: 0,
        timerEndsAt: null,
      },
    ],
    submissions: [
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        studentName: "Anonymous",
        text: "There is no evidence against the null model, so the observed difference could be due to random variation.",
        drawingData: null,
        gifData: null,
        status: "visible",
        starred: false,
        flagged: false,
        version: 1,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        studentName: "Anonymous",
        text: "The p-value is 0.28, which is not small enough to suggest the bird type proportions are different.",
        drawingData: null,
        gifData: null,
        status: "visible",
        starred: true,
        flagged: false,
        version: 1,
        archivedAt: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
  };
}

async function ensureStore() {
  await mkdir(DATA_DIR, { recursive: true });

  try {
    await readFile(STORE_PATH, "utf8");
  } catch {
    await writeStore(defaultStore());
  }
}

function legacyPromptHistoryId(session: Session) {
  return `legacy-${session.code}-${session.promptUpdatedAt.replace(/[^a-zA-Z0-9]/g, "")}`;
}

function promptHistoryContainsSubmission(
  promptHistory: PromptHistoryItem,
  submission: Submission,
) {
  const createdAt = new Date(submission.createdAt).getTime();
  const startedAt = new Date(promptHistory.startedAt).getTime();
  const endedAt = promptHistory.endedAt
    ? new Date(promptHistory.endedAt).getTime()
    : Infinity;

  return createdAt >= startedAt && createdAt < endedAt;
}

async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await readFile(STORE_PATH, "utf8");
  const data = JSON.parse(raw) as Partial<StoreData>;
  const sessions = (data.sessions ?? []).map((session) => ({
    ...session,
    promptUpdatedAt: session.promptUpdatedAt ?? session.createdAt,
    timerDurationSeconds: session.timerDurationSeconds ?? 0,
    timerEndsAt: session.timerEndsAt ?? null,
  }));
  const promptHistory = data.promptHistory ?? [];
  const sessionCodesWithHistory = new Set(
    promptHistory.map((item) => item.sessionCode),
  );

  return {
    ...data,
    groupQuestions: (data.groupQuestions ?? []).map((question) => ({
      ...question,
      isAnswered: question.isAnswered ?? false,
      studentName: question.studentName ?? "Anonymous",
      archivedAt: question.archivedAt ?? null,
      updatedAt: question.updatedAt ?? question.createdAt,
      voterIds: question.voterIds ?? [],
    })),
    questionBank: (data.questionBank ?? []).map((question) => ({
      ...question,
      title: question.title ?? question.text,
      updatedAt: question.updatedAt ?? question.createdAt,
    })),
    promptHistory: [
      ...promptHistory.map((item) => ({
        ...item,
        endedAt: item.endedAt ?? null,
        startedAt: item.startedAt,
      })),
      ...sessions
        .filter((session) => !sessionCodesWithHistory.has(session.code))
        .map((session) => ({
          id: legacyPromptHistoryId(session),
          sessionCode: session.code,
          prompt: session.prompt,
          startedAt: session.promptUpdatedAt ?? session.createdAt,
          endedAt: null,
        })),
    ],
    sessions,
    submissions: (data.submissions ?? []).map((submission) => ({
      ...submission,
      drawingData: submission.drawingData ?? null,
      gifData: submission.gifData ?? null,
      studentName: submission.studentName ?? "Anonymous",
      archivedAt: submission.archivedAt ?? null,
    })),
  };
}

async function writeStore(data: StoreData) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(STORE_PATH, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

export const localStore: QwtStore = {
  async getSession(code) {
    const sessionCode = normalizeSessionCode(code);

    if (!sessionCode) {
      return null;
    }

    const data = await readStore();
    return data.sessions.find((session) => session.code === sessionCode) ?? null;
  },

  async getOrCreateSession(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const existing = data.sessions.find((session) => session.code === sessionCode);

    if (existing) {
      return existing;
    }

    const timestamp = now();
    const session: Session = {
      code: sessionCode,
      title: titleFromCode(sessionCode) || "Quick Write",
      prompt: DEFAULT_PROMPT,
      isOpen: true,
      createdAt: timestamp,
      promptUpdatedAt: timestamp,
      timerDurationSeconds: 0,
      timerEndsAt: null,
    };

    data.sessions.push(session);
    data.promptHistory.push({
      id: randomUUID(),
      sessionCode: session.code,
      prompt: session.prompt,
      startedAt: timestamp,
      endedAt: null,
    });
    await writeStore(data);
    return session;
  },

  async listSessions() {
    const data = await readStore();

    return [...data.sessions].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  },

  async updateSession(code, patch) {
    const sessionCode = normalizeSessionCode(code);
    const data = await readStore();
    const index = data.sessions.findIndex((session) => session.code === sessionCode);

    if (index === -1) {
      return null;
    }

    const currentSession = data.sessions[index];
    const nextSession = applySessionPatch(currentSession, patch);
    const promptChanged = nextSession.prompt !== currentSession.prompt;

    data.sessions[index] = nextSession;

    if (promptChanged) {
      data.promptHistory = data.promptHistory.map((item) =>
        item.sessionCode === nextSession.code && !item.endedAt
          ? { ...item, endedAt: nextSession.promptUpdatedAt }
          : item,
      );
      data.promptHistory.push({
        id: randomUUID(),
        sessionCode: nextSession.code,
        prompt: nextSession.prompt,
        startedAt: nextSession.promptUpdatedAt,
        endedAt: null,
      });
    }

    await writeStore(data);
    return data.sessions[index];
  },

  async listPromptHistory(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return data.promptHistory
      .filter((item) => item.sessionCode === sessionCode)
      .sort(
        (a, b) =>
          new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      );
  },

  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const promptHistory = options.promptHistoryId
      ? data.promptHistory.find(
          (item) =>
            item.sessionCode === sessionCode && item.id === options.promptHistoryId,
        )
      : null;
    const cutoff =
      typeof options.minutes === "number" && options.minutes > 0
        ? Date.now() - options.minutes * 60 * 1000
        : 0;

    return data.submissions
      .filter((submission) => submission.sessionCode === sessionCode)
      .filter((submission) => options.includeArchived || !submission.archivedAt)
      .filter((submission) => options.includeHidden || submission.status !== "hidden")
      .filter((submission) =>
        promptHistory ? promptHistoryContainsSubmission(promptHistory, submission) : true,
      )
      .filter((submission) => new Date(submission.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addSubmission(code, text, drawingData, gifData, studentName) {
    const submissionContent = validateSubmissionContent(text, drawingData, gifData);
    const session = await this.getSession(code);

    if (!session) {
      throw new Error("This quick write session does not exist. Check the code from your teacher.");
    }

    if (!session.isOpen) {
      throw new Error("This quick write session is closed.");
    }

    const data = await readStore();
    const timestamp = now();
    const submission: Submission = {
      id: randomUUID(),
      sessionCode: session.code,
      studentName: normalizeStudentName(studentName ?? ""),
      text: submissionContent.text,
      drawingData: submissionContent.drawingData,
      gifData: submissionContent.gifData,
      status: "visible",
      starred: false,
      flagged: false,
      version: 1,
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.submissions.push(submission);
    await writeStore(data);
    return submission;
  },

  async updateSubmission(id, patch) {
    const data = await readStore();
    const index = data.submissions.findIndex((submission) => submission.id === id);

    if (index === -1) {
      return null;
    }

    const current = data.submissions[index];
    const next: Submission = {
      ...current,
      ...normalizeSubmissionPatch(patch),
      version: current.version + 1,
      updatedAt: now(),
    };

    assertSubmissionHasContent(next.text, next.drawingData, next.gifData);

    data.submissions[index] = next;
    await writeStore(data);
    return next;
  },

  async getSessionStats(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const submissions = data.submissions.filter(
      (submission) => submission.sessionCode === sessionCode,
    );

    return calculateStats(submissions);
  },

  async listQuestionBank(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();

    return data.questionBank
      .filter((question) => question.sessionCode === sessionCode)
      .sort((a, b) => a.title.localeCompare(b.title));
  },

  async addQuestionToBank(code, text, title) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    const questionText = validateQuestionText(text);
    const questionTitle = validateQuestionTitle(title, questionText);
    const data = await readStore();
    const timestamp = now();
    const question: QuestionBankItem = {
      id: randomUUID(),
      sessionCode: session.code,
      title: questionTitle,
      text: questionText,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.questionBank.push(question);
    await writeStore(data);
    return question;
  },

  async deleteQuestionFromBank(id) {
    const data = await readStore();
    const nextQuestionBank = data.questionBank.filter((question) => question.id !== id);

    if (nextQuestionBank.length === data.questionBank.length) {
      return false;
    }

    data.questionBank = nextQuestionBank;
    await writeStore(data);
    return true;
  },

  async listGroupQuestions(code, voterId, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const normalizedVoterId = voterId ? validateGroupQuestionVoterId(voterId) : "";
    const data = await readStore();

    return data.groupQuestions
      .filter((question) => question.sessionCode === sessionCode)
      .filter((question) => options.includeArchived || !question.archivedAt)
      .filter((question) => options.includeAnswered || !question.isAnswered)
      .map((question) => ({
        id: question.id,
        sessionCode: question.sessionCode,
        studentName: question.studentName,
        text: question.text,
        isAnswered: question.isAnswered,
        voteCount: question.voterIds.length,
        hasVoted: normalizedVoterId
          ? question.voterIds.includes(normalizedVoterId)
          : false,
        archivedAt: question.archivedAt,
        createdAt: question.createdAt,
        updatedAt: question.updatedAt,
      }))
      .sort(
        (a, b) =>
          Number(a.isAnswered) - Number(b.isAnswered) ||
          b.voteCount - a.voteCount ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async addGroupQuestion(code, text, studentName) {
    const session = await this.getSession(code);

    if (!session) {
      return null;
    }

    if (!session.isOpen) {
      throw new Error("This session is closed.");
    }

    const data = await readStore();
    const timestamp = now();
    const question: StoredGroupQuestion = {
      id: randomUUID(),
      sessionCode: session.code,
      studentName: normalizeStudentName(studentName ?? ""),
      text: validateGroupQuestionText(text),
      isAnswered: false,
      voterIds: [],
      archivedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    data.groupQuestions.push(question);
    await writeStore(data);

    return {
      ...question,
      hasVoted: false,
      voteCount: 0,
    };
  },

  async upvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const data = await readStore();
    const index = data.groupQuestions.findIndex((question) => question.id === id);

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];

    if (!question.voterIds.includes(normalizedVoterId)) {
      question.voterIds.push(normalizedVoterId);
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      voteCount: question.voterIds.length,
      hasVoted: true,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async unvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const data = await readStore();
    const index = data.groupQuestions.findIndex((question) => question.id === id);

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];
    const nextVoterIds = question.voterIds.filter(
      (storedVoterId) => storedVoterId !== normalizedVoterId,
    );

    if (nextVoterIds.length !== question.voterIds.length) {
      question.voterIds = nextVoterIds;
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async setGroupQuestionAnswered(id, isAnswered) {
    const data = await readStore();
    const index = data.groupQuestions.findIndex((question) => question.id === id);

    if (index === -1) {
      return null;
    }

    const question = data.groupQuestions[index];

    if (question.isAnswered !== isAnswered) {
      question.isAnswered = isAnswered;
      question.updatedAt = now();
      data.groupQuestions[index] = question;
      await writeStore(data);
    }

    return {
      id: question.id,
      sessionCode: question.sessionCode,
      studentName: question.studentName,
      text: question.text,
      isAnswered: question.isAnswered,
      voteCount: question.voterIds.length,
      hasVoted: false,
      archivedAt: question.archivedAt,
      createdAt: question.createdAt,
      updatedAt: question.updatedAt,
    };
  },

  async archiveSessionActivity(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const session = await this.getSession(sessionCode);

    if (!session) {
      return null;
    }

    const data = await readStore();
    const archivedAt = now();
    let submissions = 0;
    let groupQuestions = 0;

    data.submissions = data.submissions.map((submission) => {
      if (submission.sessionCode !== session.code || submission.archivedAt) {
        return submission;
      }

      submissions += 1;
      return {
        ...submission,
        archivedAt,
        updatedAt: archivedAt,
      };
    });

    data.groupQuestions = data.groupQuestions.map((question) => {
      if (question.sessionCode !== session.code || question.archivedAt) {
        return question;
      }

      groupQuestions += 1;
      return {
        ...question,
        archivedAt,
        updatedAt: archivedAt,
      };
    });

    await writeStore(data);

    return {
      archivedAt,
      groupQuestions,
      submissions,
    };
  },

  async unarchiveSessionActivity(code, archivedAt) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const session = await this.getSession(sessionCode);

    if (!session) {
      return null;
    }

    const archiveDate = new Date(archivedAt);

    if (!Number.isFinite(archiveDate.getTime())) {
      throw new Error("Archive timestamp could not be read.");
    }

    const data = await readStore();
    const restoredAt = now();
    let submissions = 0;
    let groupQuestions = 0;

    data.submissions = data.submissions.map((submission) => {
      if (
        submission.sessionCode !== session.code ||
        submission.archivedAt !== archivedAt
      ) {
        return submission;
      }

      submissions += 1;
      return {
        ...submission,
        archivedAt: null,
        updatedAt: restoredAt,
      };
    });

    data.groupQuestions = data.groupQuestions.map((question) => {
      if (
        question.sessionCode !== session.code ||
        question.archivedAt !== archivedAt
      ) {
        return question;
      }

      groupQuestions += 1;
      return {
        ...question,
        archivedAt: null,
        updatedAt: restoredAt,
      };
    });

    await writeStore(data);

    return {
      archivedAt,
      groupQuestions,
      submissions,
    };
  },
};
