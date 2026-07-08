export type SubmissionStatus = "visible" | "hidden";

export type DrawingPoint = {
  x: number;
  y: number;
};

export type DrawingStroke = {
  color: string;
  size: number;
  points: DrawingPoint[];
};

export type DrawingData = {
  version: 1;
  width: number;
  height: number;
  strokes: DrawingStroke[];
};

export type GifData = {
  id: string;
  title: string;
  url: string;
  previewUrl: string;
  giphyUrl: string;
  width: number;
  height: number;
};

export type Session = {
  code: string;
  title: string;
  prompt: string;
  isOpen: boolean;
  createdAt: string;
  promptUpdatedAt: string;
  timerDurationSeconds: number;
  timerEndsAt: string | null;
};

export type Submission = {
  id: string;
  sessionCode: string;
  studentName: string;
  text: string;
  drawingData: DrawingData | null;
  gifData: GifData | null;
  status: SubmissionStatus;
  starred: boolean;
  flagged: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionBankItem = {
  id: string;
  sessionCode: string;
  title: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type SubmissionPatch = Partial<
  Pick<Submission, "text" | "status" | "starred" | "flagged">
>;

export type SessionPatch = Partial<
  Pick<
    Session,
    "prompt" | "title" | "isOpen" | "timerDurationSeconds" | "timerEndsAt"
  >
>;

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
  addSubmission(
    code: string,
    text: string,
    drawingData?: unknown,
    gifData?: unknown,
    studentName?: string,
  ): Promise<Submission>;
  updateSubmission(id: string, patch: SubmissionPatch): Promise<Submission | null>;
  getSessionStats(code: string): Promise<SessionStats>;
  listQuestionBank(code: string): Promise<QuestionBankItem[]>;
  addQuestionToBank(
    code: string,
    text: string,
    title?: string,
  ): Promise<QuestionBankItem | null>;
  deleteQuestionFromBank(id: string): Promise<boolean>;
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

export function normalizeStudentName(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return "Anonymous";
  }

  if (normalized.length > 80) {
    throw new Error("Name must be 80 characters or fewer.");
  }

  return normalized;
}

const DRAWING_COLORS = new Set(["#0f172a", "#2563eb", "#dc2626", "#0f766e"]);
const MAX_DRAWING_STROKES = 120;
const MAX_DRAWING_POINTS = 12000;
const MAX_DRAWING_PAYLOAD_CHARS = 180000;
const MAX_GIPHY_URL_CHARS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(max, Math.max(min, value));
}

export function normalizeDrawingData(value: unknown): DrawingData | null {
  if (!value) {
    return null;
  }

  if (!isRecord(value) || !Array.isArray(value.strokes)) {
    throw new Error("The drawing data could not be read.");
  }

  const width = boundedNumber(value.width, 100, 2000);
  const height = boundedNumber(value.height, 100, 2000);

  if (!width || !height) {
    throw new Error("The drawing data could not be read.");
  }

  const strokes: DrawingStroke[] = [];
  let pointCount = 0;

  if (value.strokes.length > MAX_DRAWING_STROKES) {
    throw new Error("Please keep drawings a little simpler for this prototype.");
  }

  for (const rawStroke of value.strokes) {
    if (!isRecord(rawStroke) || !Array.isArray(rawStroke.points)) {
      continue;
    }

    const color = typeof rawStroke.color === "string" ? rawStroke.color : "#0f172a";
    const size = boundedNumber(rawStroke.size, 1, 18) ?? 3;
    const points: DrawingPoint[] = [];

    for (const rawPoint of rawStroke.points) {
      if (!isRecord(rawPoint)) {
        continue;
      }

      const x = boundedNumber(rawPoint.x, 0, width);
      const y = boundedNumber(rawPoint.y, 0, height);

      if (x === null || y === null) {
        continue;
      }

      points.push({
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
      });
      pointCount += 1;

      if (pointCount > MAX_DRAWING_POINTS) {
        throw new Error("Please keep drawings a little simpler for this prototype.");
      }
    }

    if (points.length > 0) {
      strokes.push({
        color: DRAWING_COLORS.has(color) ? color : "#0f172a",
        size,
        points,
      });
    }
  }

  if (!strokes.length) {
    return null;
  }

  const drawingData: DrawingData = {
    version: 1,
    width,
    height,
    strokes,
  };

  if (JSON.stringify(drawingData).length > MAX_DRAWING_PAYLOAD_CHARS) {
    throw new Error("Please keep drawings a little simpler for this prototype.");
  }

  return drawingData;
}

function normalizeGiphyUrl(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} could not be read.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > MAX_GIPHY_URL_CHARS) {
    throw new Error(`${label} is too long.`);
  }

  try {
    const url = new URL(trimmed);
    const hostname = url.hostname.toLowerCase();

    if (
      url.protocol !== "https:" ||
      (hostname !== "giphy.com" && !hostname.endsWith(".giphy.com"))
    ) {
      throw new Error();
    }

    return url.toString();
  } catch {
    throw new Error(`${label} must be a GIPHY URL.`);
  }
}

export function normalizeGifData(value: unknown): GifData | null {
  if (!value) {
    return null;
  }

  if (!isRecord(value)) {
    throw new Error("The GIF data could not be read.");
  }

  const rawId = typeof value.id === "string" ? value.id.trim() : "";

  if (!/^[a-zA-Z0-9_-]{1,120}$/.test(rawId)) {
    throw new Error("The GIF data could not be read.");
  }

  const title =
    typeof value.title === "string" && value.title.trim()
      ? value.title.trim().replace(/\s+/g, " ").slice(0, 160)
      : "GIPHY GIF";
  const url = normalizeGiphyUrl(value.url, "GIF URL");
  const previewUrl = value.previewUrl
    ? normalizeGiphyUrl(value.previewUrl, "GIF preview URL")
    : url;
  const giphyUrl = value.giphyUrl
    ? normalizeGiphyUrl(value.giphyUrl, "GIPHY page URL")
    : `https://giphy.com/gifs/${rawId}`;

  return {
    id: rawId,
    title,
    url,
    previewUrl,
    giphyUrl,
    width: boundedNumber(value.width, 1, 2000) ?? 320,
    height: boundedNumber(value.height, 1, 2000) ?? 180,
  };
}

export function validateSubmissionText(text: string) {
  const trimmed = text.trim();

  if (trimmed.length > 2000) {
    throw new Error("Please keep submissions under 2000 characters for the prototype.");
  }

  return trimmed;
}

export function validateQuestionText(text: string) {
  const trimmed = text.trim();

  if (trimmed.length < 5) {
    throw new Error("Question must be at least 5 characters.");
  }

  if (trimmed.length > 1200) {
    throw new Error("Question must be 1200 characters or fewer.");
  }

  return trimmed;
}

export function validateQuestionTitle(title: string | undefined, fallbackText: string) {
  const trimmed = title?.trim() || fallbackText.trim();

  if (trimmed.length < 1) {
    throw new Error("Question title is required.");
  }

  if (trimmed.length > 1200) {
    throw new Error("Question title must be 1200 characters or fewer.");
  }

  return trimmed;
}

export function validateSubmissionContent(
  text: string,
  drawingData: unknown,
  gifData: unknown,
) {
  const trimmed = validateSubmissionText(text);
  const normalizedDrawingData = normalizeDrawingData(drawingData);
  const normalizedGifData = normalizeGifData(gifData);

  assertSubmissionHasContent(trimmed, normalizedDrawingData, normalizedGifData);

  return {
    text: trimmed,
    drawingData: normalizedDrawingData,
    gifData: normalizedGifData,
  };
}

export function assertSubmissionHasContent(
  text: string,
  drawingData: DrawingData | null,
  gifData: GifData | null,
) {
  if (text.trim().length < 1 && !drawingData && !gifData) {
    throw new Error("A submission needs text, a drawing, or a GIF.");
  }
}

export function applySessionPatch(current: Session, patch: SessionPatch) {
  const nextPrompt =
    typeof patch.prompt === "string" ? patch.prompt.trim() : current.prompt;
  const nextTitle =
    typeof patch.title === "string" ? patch.title.trim() : current.title;
  const promptChanged = nextPrompt !== current.prompt;

  if (nextPrompt.length < 5) {
    throw new Error("Prompt must be at least 5 characters.");
  }

  if (nextPrompt.length > 1200) {
    throw new Error("Prompt must be 1200 characters or fewer.");
  }

  let nextTimerDurationSeconds = current.timerDurationSeconds;
  let nextTimerEndsAt = current.timerEndsAt;

  if (typeof patch.timerDurationSeconds === "number") {
    if (
      !Number.isFinite(patch.timerDurationSeconds) ||
      patch.timerDurationSeconds < 0 ||
      patch.timerDurationSeconds > 3600
    ) {
      throw new Error("Timer must be between 0 and 3600 seconds.");
    }

    nextTimerDurationSeconds = Math.round(patch.timerDurationSeconds);
  }

  if ("timerEndsAt" in patch) {
    if (patch.timerEndsAt === null || patch.timerEndsAt === undefined) {
      nextTimerEndsAt = null;
    } else {
      const timerDate = new Date(patch.timerEndsAt);

      if (!Number.isFinite(timerDate.getTime())) {
        throw new Error("Timer end time could not be read.");
      }

      nextTimerEndsAt = timerDate.toISOString();
    }
  }

  if (!nextTimerEndsAt) {
    nextTimerDurationSeconds = 0;
  }

  return {
    ...current,
    prompt: nextPrompt,
    promptUpdatedAt: promptChanged ? now() : current.promptUpdatedAt,
    title: nextTitle || current.title,
    isOpen: typeof patch.isOpen === "boolean" ? patch.isOpen : current.isOpen,
    timerDurationSeconds: nextTimerDurationSeconds,
    timerEndsAt: nextTimerEndsAt,
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
