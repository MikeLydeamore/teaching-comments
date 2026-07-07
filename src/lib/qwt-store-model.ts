export type SubmissionStatus = "visible" | "hidden";

export type Session = {
  code: string;
  title: string;
  prompt: string;
  isOpen: boolean;
  createdAt: string;
};

export type Submission = {
  id: string;
  sessionCode: string;
  text: string;
  status: SubmissionStatus;
  starred: boolean;
  flagged: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionPatch = Partial<
  Pick<Submission, "text" | "status" | "starred" | "flagged">
>;

export type SessionPatch = Partial<Pick<Session, "prompt" | "title" | "isOpen">>;

export type SessionStats = {
  total: number;
  visible: number;
  hidden: number;
  starred: number;
  flagged: number;
  latestAt?: string;
};

export type QwtStore = {
  getSession(code: string): Promise<Session | null>;
  getOrCreateSession(code: string): Promise<Session>;
  listSessions(): Promise<Session[]>;
  updateSession(code: string, patch: SessionPatch): Promise<Session | null>;
  listSubmissions(
    code: string,
    options?: { minutes?: number; includeHidden?: boolean },
  ): Promise<Submission[]>;
  addSubmission(code: string, text: string): Promise<Submission>;
  updateSubmission(id: string, patch: SubmissionPatch): Promise<Submission | null>;
  getSessionStats(code: string): Promise<SessionStats>;
};

export const DEFAULT_PROMPT =
  "In one or two sentences, explain what the p-value tells us in this setting.";

export function now() {
  return new Date().toISOString();
}

export function normalizeSessionCode(code: string) {
  return code
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function titleFromCode(code: string) {
  return code
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function validateSubmissionText(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 2) {
    throw new Error("Please enter a little more before submitting.");
  }

  if (trimmed.length > 2000) {
    throw new Error("Please keep submissions under 2000 characters for the prototype.");
  }

  return trimmed;
}

export function applySessionPatch(current: Session, patch: SessionPatch) {
  const nextPrompt =
    typeof patch.prompt === "string" ? patch.prompt.trim() : current.prompt;
  const nextTitle =
    typeof patch.title === "string" ? patch.title.trim() : current.title;

  if (nextPrompt.length < 5) {
    throw new Error("Prompt must be at least 5 characters.");
  }

  if (nextPrompt.length > 1200) {
    throw new Error("Prompt must be 1200 characters or fewer.");
  }

  return {
    ...current,
    prompt: nextPrompt,
    title: nextTitle || current.title,
    isOpen: typeof patch.isOpen === "boolean" ? patch.isOpen : current.isOpen,
  };
}

export function normalizeSubmissionPatch(patch: SubmissionPatch) {
  const next: SubmissionPatch = {};

  if (typeof patch.text === "string") {
    next.text = validateSubmissionText(patch.text);
  }

  if (patch.status === "visible" || patch.status === "hidden") {
    next.status = patch.status;
  }

  if (typeof patch.starred === "boolean") {
    next.starred = patch.starred;
  }

  if (typeof patch.flagged === "boolean") {
    next.flagged = patch.flagged;
  }

  return next;
}

export function calculateStats(submissions: Pick<Submission, "status" | "starred" | "flagged" | "createdAt">[]) {
  return {
    total: submissions.length,
    visible: submissions.filter((submission) => submission.status === "visible").length,
    hidden: submissions.filter((submission) => submission.status === "hidden").length,
    starred: submissions.filter((submission) => submission.starred).length,
    flagged: submissions.filter((submission) => submission.flagged).length,
    latestAt: submissions
      .map((submission) => submission.createdAt)
      .sort()
      .at(-1),
  };
}
