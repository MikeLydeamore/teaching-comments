import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_PROMPT,
  applySessionPatch,
  calculateStats,
  normalizeSessionCode,
  normalizeSubmissionPatch,
  now,
  titleFromCode,
  validateSubmissionText,
  type QwtStore,
  type Session,
  type Submission,
} from "./qwt-store-model";

type StoreData = {
  sessions: Session[];
  submissions: Submission[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "qwt-store.json");

function defaultStore(): StoreData {
  const createdAt = now();

  return {
    sessions: [
      {
        code: "demo-lecture",
        title: "Demo Lecture",
        prompt: DEFAULT_PROMPT,
        isOpen: true,
        createdAt,
      },
    ],
    submissions: [
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        text: "There is no evidence against the null model, so the observed difference could be due to random variation.",
        status: "visible",
        starred: false,
        flagged: false,
        version: 1,
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: randomUUID(),
        sessionCode: "demo-lecture",
        text: "The p-value is 0.28, which is not small enough to suggest the bird type proportions are different.",
        status: "visible",
        starred: true,
        flagged: false,
        version: 1,
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

async function readStore(): Promise<StoreData> {
  await ensureStore();
  const raw = await readFile(STORE_PATH, "utf8");
  return JSON.parse(raw) as StoreData;
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

    const session: Session = {
      code: sessionCode,
      title: titleFromCode(sessionCode) || "Quick Write",
      prompt: DEFAULT_PROMPT,
      isOpen: true,
      createdAt: now(),
    };

    data.sessions.push(session);
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

    data.sessions[index] = applySessionPatch(data.sessions[index], patch);
    await writeStore(data);
    return data.sessions[index];
  },

  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const data = await readStore();
    const cutoff =
      typeof options.minutes === "number" && options.minutes > 0
        ? Date.now() - options.minutes * 60 * 1000
        : 0;

    return data.submissions
      .filter((submission) => submission.sessionCode === sessionCode)
      .filter((submission) => options.includeHidden || submission.status !== "hidden")
      .filter((submission) => new Date(submission.createdAt).getTime() >= cutoff)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async addSubmission(code, text) {
    const trimmed = validateSubmissionText(text);
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
      text: trimmed,
      status: "visible",
      starred: false,
      flagged: false,
      version: 1,
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
};
