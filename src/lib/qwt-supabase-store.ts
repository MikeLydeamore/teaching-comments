import {
  DEFAULT_SPACE_CODE,
  DEFAULT_PROMPT,
  applySessionPatch,
  assertSubmissionHasContent,
  calculateStats,
  normalizeSessionCode,
  normalizeSpaceCode,
  normalizeStudentName,
  normalizeSubmissionPatch,
  now,
  titleFromCode,
  validateGroupQuestionText,
  validateGroupQuestionVoterId,
  validateQuestionTitle,
  validateQuestionText,
  validateSubmissionContent,
  validateTeacherSpaceName,
  validateTeacherSpacePinHash,
  type DrawingData,
  type GifData,
  type GroupQuestion,
  type PromptHistoryItem,
  type QuestionBankItem,
  type QwtStore,
  type Session,
  type Submission,
  type TeacherSpace,
} from "./qwt-store-model";

type SupabaseTeacherSpaceRow = {
  code: string;
  name: string;
  pin_hash: string;
  created_at: string;
};

type SupabaseTeacherSpaceSummaryRow = {
  code: string;
  name: string;
  created_at: string;
};

type SupabaseSessionRow = {
  code: string;
  space_code: string;
  title: string;
  prompt: string;
  is_open: boolean;
  created_at: string;
  prompt_updated_at: string;
  timer_duration_seconds: number;
  timer_ends_at: string | null;
};

type SupabaseSubmissionRow = {
  id: string;
  session_code: string;
  student_name: string;
  text: string;
  drawing_data: DrawingData | null;
  gif_data: GifData | null;
  status: "visible" | "hidden";
  starred: boolean;
  flagged: boolean;
  version: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseQuestionBankRow = {
  id: string;
  session_code: string;
  title: string;
  text: string;
  created_at: string;
  updated_at: string;
};

type SupabasePromptHistoryRow = {
  id: string;
  session_code: string;
  prompt: string;
  started_at: string;
  ended_at: string | null;
};

type SupabaseGroupQuestionRow = {
  id: string;
  session_code: string;
  student_name: string;
  text: string;
  is_answered: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseGroupQuestionVoteRow = {
  question_id: string;
  voter_id: string;
  created_at: string;
};

class SupabaseStoreError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SupabaseStoreError";
  }
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase storage is enabled, but SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are not both set.",
    );
  }

  return { url, serviceRoleKey };
}

async function supabaseFetch<T>(
  path: string,
  init: RequestInit & { prefer?: string } = {},
): Promise<T> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const { prefer, headers, ...requestInit } = init;
  const requestHeaders = new Headers(headers);
  requestHeaders.set("apikey", serviceRoleKey);
  requestHeaders.set("Authorization", `Bearer ${serviceRoleKey}`);
  requestHeaders.set("Content-Type", "application/json");

  if (prefer) {
    requestHeaders.set("Prefer", prefer);
  }

  const response = await fetch(`${url}/rest/v1${path}`, {
    ...requestInit,
    cache: "no-store",
    headers: requestHeaders,
  });

  const body = await response.text();
  const payload = body ? JSON.parse(body) : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String(payload.message)
        : "The database request failed.";
    throw new SupabaseStoreError(message, response.status);
  }

  return payload as T;
}

function encodeFilterValue(value: string) {
  return encodeURIComponent(value);
}

function sessionSelect() {
  return "code,space_code,title,prompt,is_open,created_at,prompt_updated_at,timer_duration_seconds,timer_ends_at";
}

function teacherSpaceSelect() {
  return "code,name,pin_hash,created_at";
}

function teacherSpaceSummarySelect() {
  return "code,name,created_at";
}

function submissionSelect() {
  return "id,session_code,student_name,text,drawing_data,gif_data,status,starred,flagged,version,archived_at,created_at,updated_at";
}

function questionBankSelect() {
  return "id,session_code,title,text,created_at,updated_at";
}

function promptHistorySelect() {
  return "id,session_code,prompt,started_at,ended_at";
}

function groupQuestionSelect() {
  return "id,session_code,student_name,text,is_answered,archived_at,created_at,updated_at";
}

function groupQuestionVoteSelect() {
  return "question_id,voter_id,created_at";
}

function sessionFromRow(row: SupabaseSessionRow): Session {
  return {
    code: row.code,
    spaceCode: row.space_code ?? DEFAULT_SPACE_CODE,
    title: row.title,
    prompt: row.prompt,
    isOpen: row.is_open,
    createdAt: row.created_at,
    promptUpdatedAt: row.prompt_updated_at ?? row.created_at,
    timerDurationSeconds: row.timer_duration_seconds ?? 0,
    timerEndsAt: row.timer_ends_at ?? null,
  };
}

function teacherSpaceFromRow(row: SupabaseTeacherSpaceRow): TeacherSpace {
  return {
    code: row.code,
    name: row.name,
    pinHash: row.pin_hash,
    createdAt: row.created_at,
  };
}

function teacherSpaceSummaryFromRow(row: SupabaseTeacherSpaceSummaryRow) {
  return {
    code: row.code,
    name: row.name,
    createdAt: row.created_at,
  };
}

function submissionFromRow(row: SupabaseSubmissionRow): Submission {
  return {
    id: row.id,
    sessionCode: row.session_code,
    studentName: row.student_name ?? "Anonymous",
    text: row.text,
    drawingData: row.drawing_data ?? null,
    gifData: row.gif_data ?? null,
    status: row.status,
    starred: row.starred,
    flagged: row.flagged,
    version: row.version,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function questionBankItemFromRow(row: SupabaseQuestionBankRow): QuestionBankItem {
  return {
    id: row.id,
    sessionCode: row.session_code,
    title: row.title ?? row.text,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function promptHistoryItemFromRow(row: SupabasePromptHistoryRow): PromptHistoryItem {
  return {
    id: row.id,
    sessionCode: row.session_code,
    prompt: row.prompt,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? null,
  };
}

function groupQuestionFromRow(
  row: SupabaseGroupQuestionRow,
  votes: SupabaseGroupQuestionVoteRow[],
  voterId = "",
): GroupQuestion {
  const questionVotes = votes.filter((vote) => vote.question_id === row.id);

  return {
    id: row.id,
    sessionCode: row.session_code,
    studentName: row.student_name ?? "Anonymous",
    text: row.text,
    isAnswered: row.is_answered,
    voteCount: questionVotes.length,
    hasVoted: voterId
      ? questionVotes.some((vote) => vote.voter_id === voterId)
      : false,
    archivedAt: row.archived_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getSessionFromSupabase(code: string) {
  const sessionCode = normalizeSessionCode(code);

  if (!sessionCode) {
    return null;
  }

  const rows = await supabaseFetch<SupabaseSessionRow[]>(
    `/qwt_sessions?code=eq.${encodeFilterValue(sessionCode)}&select=${sessionSelect()}&limit=1`,
  );

  return rows[0] ? sessionFromRow(rows[0]) : null;
}

async function getTeacherSpaceFromSupabase(code: string) {
  const spaceCode = normalizeSpaceCode(code);

  if (!spaceCode) {
    return null;
  }

  const rows = await supabaseFetch<SupabaseTeacherSpaceRow[]>(
    `/qwt_teacher_spaces?code=eq.${encodeFilterValue(spaceCode)}&select=${teacherSpaceSelect()}&limit=1`,
  );

  return rows[0] ? teacherSpaceFromRow(rows[0]) : null;
}

async function getSessionInSpaceFromSupabase(spaceCode: string, code: string) {
  const normalizedSpaceCode = normalizeSpaceCode(spaceCode);
  const sessionCode = normalizeSessionCode(code);

  if (!normalizedSpaceCode || !sessionCode) {
    return null;
  }

  const params = new URLSearchParams({
    code: `eq.${sessionCode}`,
    space_code: `eq.${normalizedSpaceCode}`,
    select: sessionSelect(),
    limit: "1",
  });
  const rows = await supabaseFetch<SupabaseSessionRow[]>(
    `/qwt_sessions?${params.toString()}`,
  );

  return rows[0] ? sessionFromRow(rows[0]) : null;
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

async function listPromptHistoryRows(sessionCode: string) {
  return supabaseFetch<SupabasePromptHistoryRow[]>(
    `/qwt_prompt_history?session_code=eq.${encodeFilterValue(sessionCode)}&select=${promptHistorySelect()}&order=started_at.desc`,
  );
}

async function ensurePromptHistoryForSession(session: Session) {
  const existingRows = await listPromptHistoryRows(session.code);

  if (existingRows.length) {
    return existingRows;
  }

  return supabaseFetch<SupabasePromptHistoryRow[]>(
    `/qwt_prompt_history?select=${promptHistorySelect()}`,
    {
      method: "POST",
      body: JSON.stringify({
        session_code: session.code,
        prompt: session.prompt,
        started_at: session.promptUpdatedAt ?? session.createdAt,
        ended_at: null,
      }),
      prefer: "return=representation",
    },
  );
}

async function listVotesForQuestionIds(questionIds: string[]) {
  if (!questionIds.length) {
    return [];
  }

  return supabaseFetch<SupabaseGroupQuestionVoteRow[]>(
    `/qwt_group_question_votes?question_id=in.(${questionIds.join(",")})&select=${groupQuestionVoteSelect()}`,
  );
}

async function getGroupQuestionFromSupabase(id: string, voterId = "") {
  const rows = await supabaseFetch<SupabaseGroupQuestionRow[]>(
    `/qwt_group_questions?id=eq.${encodeFilterValue(id)}&select=${groupQuestionSelect()}&limit=1`,
  );
  const question = rows[0];

  if (!question) {
    return null;
  }

  const votes = await listVotesForQuestionIds([question.id]);
  return groupQuestionFromRow(question, votes, voterId);
}

export const supabaseStore: QwtStore = {
  async createTeacherSpace(code, name, pinHash) {
    const spaceCode = normalizeSpaceCode(code);

    if (!spaceCode) {
      throw new Error("Space code is required.");
    }

    const rows = await supabaseFetch<SupabaseTeacherSpaceRow[]>(
      `/qwt_teacher_spaces?select=${teacherSpaceSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          code: spaceCode,
          name: validateTeacherSpaceName(name),
          pin_hash: validateTeacherSpacePinHash(pinHash),
        }),
        prefer: "return=representation",
      },
    ).catch((error) => {
      if (error instanceof SupabaseStoreError && error.status === 409) {
        throw new Error("That space code already exists.");
      }

      throw error;
    });

    return teacherSpaceFromRow(rows[0]);
  },

  getTeacherSpace: getTeacherSpaceFromSupabase,

  async listTeacherSpaces() {
    const rows = await supabaseFetch<SupabaseTeacherSpaceSummaryRow[]>(
      `/qwt_teacher_spaces?select=${teacherSpaceSummarySelect()}&order=name.asc`,
    );

    return rows.map(teacherSpaceSummaryFromRow);
  },

  async updateTeacherSpacePinHash(code, pinHash) {
    const spaceCode = normalizeSpaceCode(code);

    if (!spaceCode) {
      return null;
    }

    const rows = await supabaseFetch<SupabaseTeacherSpaceRow[]>(
      `/qwt_teacher_spaces?code=eq.${encodeFilterValue(spaceCode)}&select=${teacherSpaceSelect()}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          pin_hash: validateTeacherSpacePinHash(pinHash),
        }),
        prefer: "return=representation",
      },
    );

    return rows[0] ? teacherSpaceFromRow(rows[0]) : null;
  },

  getSession: getSessionFromSupabase,

  getSessionInSpace: getSessionInSpaceFromSupabase,

  async getOrCreateSession(code) {
    const session = await this.getOrCreateSessionInSpace(
      DEFAULT_SPACE_CODE,
      code,
    );

    if (!session) {
      throw new Error("Default teaching space is missing.");
    }

    return session;
  },

  async getOrCreateSessionInSpace(spaceCode, code) {
    const normalizedSpaceCode = normalizeSpaceCode(spaceCode) || DEFAULT_SPACE_CODE;
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const space = await getTeacherSpaceFromSupabase(normalizedSpaceCode);

    if (!space) {
      return null;
    }

    const existing = await getSessionInSpaceFromSupabase(
      normalizedSpaceCode,
      sessionCode,
    );

    if (existing) {
      return existing;
    }

    const timestamp = now();
    const rows = await supabaseFetch<SupabaseSessionRow[]>(
      `/qwt_sessions?select=${sessionSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          code: sessionCode,
          space_code: normalizedSpaceCode,
          title: titleFromCode(sessionCode) || "Ed.ie Session",
          prompt: DEFAULT_PROMPT,
          is_open: true,
          created_at: timestamp,
          prompt_updated_at: timestamp,
          timer_duration_seconds: 0,
          timer_ends_at: null,
        }),
        prefer: "return=representation",
      },
    ).catch(async (error) => {
      if (error instanceof SupabaseStoreError && error.status === 409) {
        const session = await getSessionFromSupabase(sessionCode);
        if (session?.spaceCode === normalizedSpaceCode) {
          return [
            {
              code: session.code,
              space_code: session.spaceCode,
              title: session.title,
              prompt: session.prompt,
              is_open: session.isOpen,
              created_at: session.createdAt,
              prompt_updated_at: session.promptUpdatedAt,
              timer_duration_seconds: session.timerDurationSeconds,
              timer_ends_at: session.timerEndsAt,
            },
          ];
        }

        throw new Error("That session code is already used in another space.");
      }

      throw error;
    });

    const session = sessionFromRow(rows[0]);
    await ensurePromptHistoryForSession(session);
    return session;
  },

  async listSessions(spaceCode) {
    const params = new URLSearchParams({
      select: sessionSelect(),
      order: "created_at.desc",
    });
    const normalizedSpaceCode = spaceCode ? normalizeSpaceCode(spaceCode) : "";

    if (normalizedSpaceCode) {
      params.set("space_code", `eq.${normalizedSpaceCode}`);
    }

    const rows = await supabaseFetch<SupabaseSessionRow[]>(
      `/qwt_sessions?${params.toString()}`,
    );

    return rows.map(sessionFromRow);
  },

  async updateSession(code, patch) {
    const current = await getSessionFromSupabase(code);

    if (!current) {
      return null;
    }

    const next = applySessionPatch(current, patch);
    const promptChanged = next.prompt !== current.prompt;
    const rows = await supabaseFetch<SupabaseSessionRow[]>(
      `/qwt_sessions?code=eq.${encodeFilterValue(current.code)}&select=${sessionSelect()}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: next.title,
          prompt: next.prompt,
          prompt_updated_at: next.promptUpdatedAt,
          timer_duration_seconds: next.timerDurationSeconds,
          timer_ends_at: next.timerEndsAt,
          is_open: next.isOpen,
        }),
        prefer: "return=representation",
      },
    );

    const session = rows[0] ? sessionFromRow(rows[0]) : null;

    if (session && promptChanged) {
      await ensurePromptHistoryForSession(current);
      await supabaseFetch<SupabasePromptHistoryRow[]>(
        `/qwt_prompt_history?session_code=eq.${encodeFilterValue(current.code)}&ended_at=is.null&select=${promptHistorySelect()}`,
        {
          method: "PATCH",
          body: JSON.stringify({ ended_at: session.promptUpdatedAt }),
          prefer: "return=representation",
        },
      );
      await supabaseFetch<SupabasePromptHistoryRow[]>(
        `/qwt_prompt_history?select=${promptHistorySelect()}`,
        {
          method: "POST",
          body: JSON.stringify({
            session_code: session.code,
            prompt: session.prompt,
            started_at: session.promptUpdatedAt,
            ended_at: null,
          }),
          prefer: "return=representation",
        },
      );
    }

    return session;
  },

  async listPromptHistory(code) {
    const session = await getSessionFromSupabase(code);

    if (!session) {
      return [];
    }

    const rows = await ensurePromptHistoryForSession(session);
    return rows.map(promptHistoryItemFromRow);
  },

  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const promptHistoryRows = options.promptHistoryId
      ? await listPromptHistoryRows(sessionCode)
      : [];
    const promptHistory = options.promptHistoryId
      ? promptHistoryRows
          .map(promptHistoryItemFromRow)
          .find((item) => item.id === options.promptHistoryId)
      : null;

    if (options.promptHistoryId && !promptHistory) {
      return [];
    }

    const params = new URLSearchParams({
      session_code: `eq.${sessionCode}`,
      select: submissionSelect(),
      order: "created_at.desc",
    });

    if (!options.includeHidden) {
      params.set("status", "neq.hidden");
    }

    if (!options.includeArchived) {
      params.set("archived_at", "is.null");
    }

    const cutoff =
      typeof options.minutes === "number" && options.minutes > 0
        ? new Date(Date.now() - options.minutes * 60 * 1000)
        : null;
    const promptStart = promptHistory ? new Date(promptHistory.startedAt) : null;
    const createdAfter =
      cutoff && promptStart
        ? new Date(Math.max(cutoff.getTime(), promptStart.getTime()))
        : cutoff ?? promptStart;

    if (createdAfter) {
      params.append(
        "created_at",
        `gte.${createdAfter.toISOString()}`,
      );
    }

    if (promptHistory?.endedAt) {
      params.append("created_at", `lt.${promptHistory.endedAt}`);
    }

    const rows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?${params.toString()}`,
    );

    return rows
      .map(submissionFromRow)
      .filter((submission) =>
        promptHistory
          ? promptHistoryContainsSubmission(promptHistory, submission)
          : true,
      );
  },

  async addSubmission(code, text, drawingData, gifData, studentName) {
    const submissionContent = validateSubmissionContent(text, drawingData, gifData);
    const session = await getSessionFromSupabase(code);

    if (!session) {
      throw new Error("This Ed.ie session does not exist. Check the code from your teacher.");
    }

    if (!session.isOpen) {
      throw new Error("This Ed.ie session is closed.");
    }

    const timestamp = now();
    const rows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?select=${submissionSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          session_code: session.code,
          student_name: normalizeStudentName(studentName ?? ""),
          text: submissionContent.text,
          drawing_data: submissionContent.drawingData,
          gif_data: submissionContent.gifData,
          status: "visible",
          starred: false,
          flagged: false,
          version: 1,
          archived_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
        prefer: "return=representation",
      },
    );

    return submissionFromRow(rows[0]);
  },

  async updateSubmission(id, patch) {
    const currentRows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?id=eq.${encodeFilterValue(id)}&select=${submissionSelect()}&limit=1`,
    );
    const current = currentRows[0];

    if (!current) {
      return null;
    }

    const nextPatch = normalizeSubmissionPatch(patch);
    const hasTextPatch = "text" in nextPatch;
    const nextText = hasTextPatch ? nextPatch.text ?? "" : current.text;

    assertSubmissionHasContent(nextText, current.drawing_data ?? null, current.gif_data ?? null);

    const rows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?id=eq.${encodeFilterValue(id)}&select=${submissionSelect()}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          ...(hasTextPatch ? { text: nextText } : {}),
          ...(nextPatch.status ? { status: nextPatch.status } : {}),
          ...(typeof nextPatch.starred === "boolean" ? { starred: nextPatch.starred } : {}),
          ...(typeof nextPatch.flagged === "boolean" ? { flagged: nextPatch.flagged } : {}),
          version: current.version + 1,
          updated_at: now(),
        }),
        prefer: "return=representation",
      },
    );

    return rows[0] ? submissionFromRow(rows[0]) : null;
  },

  async getSessionStats(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const params = new URLSearchParams({
      session_code: `eq.${sessionCode}`,
      select: submissionSelect(),
      archived_at: "is.null",
    });
    const rows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?${params.toString()}`,
    );

    return calculateStats(rows.map(submissionFromRow));
  },

  async listQuestionBank(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const params = new URLSearchParams({
      session_code: `eq.${sessionCode}`,
      select: questionBankSelect(),
      order: "title.asc",
    });
    const rows = await supabaseFetch<SupabaseQuestionBankRow[]>(
      `/qwt_question_bank?${params.toString()}`,
    );

    return rows.map(questionBankItemFromRow);
  },

  async addQuestionToBank(code, text, title) {
    const session = await getSessionFromSupabase(code);

    if (!session) {
      return null;
    }

    const timestamp = now();
    const rows = await supabaseFetch<SupabaseQuestionBankRow[]>(
      `/qwt_question_bank?select=${questionBankSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          session_code: session.code,
          title: validateQuestionTitle(title, text),
          text: validateQuestionText(text),
          created_at: timestamp,
          updated_at: timestamp,
        }),
        prefer: "return=representation",
      },
    );

    return rows[0] ? questionBankItemFromRow(rows[0]) : null;
  },

  async deleteQuestionFromBank(id) {
    const rows = await supabaseFetch<SupabaseQuestionBankRow[]>(
      `/qwt_question_bank?id=eq.${encodeFilterValue(id)}&select=${questionBankSelect()}`,
      {
        method: "DELETE",
        prefer: "return=representation",
      },
    );

    return rows.length > 0;
  },

  async listGroupQuestions(code, voterId, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const normalizedVoterId = voterId ? validateGroupQuestionVoterId(voterId) : "";
    const answeredFilter = options.includeAnswered ? "" : "&is_answered=eq.false";
    const archivedFilter = options.includeArchived ? "" : "&archived_at=is.null";
    const rows = await supabaseFetch<SupabaseGroupQuestionRow[]>(
      `/qwt_group_questions?session_code=eq.${encodeFilterValue(sessionCode)}${answeredFilter}${archivedFilter}&select=${groupQuestionSelect()}&order=created_at.desc`,
    );
    const votes = await listVotesForQuestionIds(rows.map((question) => question.id));

    return rows
      .map((question) => groupQuestionFromRow(question, votes, normalizedVoterId))
      .sort(
        (a, b) =>
          Number(a.isAnswered) - Number(b.isAnswered) ||
          b.voteCount - a.voteCount ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
  },

  async addGroupQuestion(code, text, studentName) {
    const session = await getSessionFromSupabase(code);

    if (!session) {
      return null;
    }

    if (!session.isOpen) {
      throw new Error("This session is closed.");
    }

    const timestamp = now();
    const rows = await supabaseFetch<SupabaseGroupQuestionRow[]>(
      `/qwt_group_questions?select=${groupQuestionSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          session_code: session.code,
          student_name: normalizeStudentName(studentName ?? ""),
          text: validateGroupQuestionText(text),
          is_answered: false,
          archived_at: null,
          created_at: timestamp,
          updated_at: timestamp,
        }),
        prefer: "return=representation",
      },
    );

    return rows[0] ? groupQuestionFromRow(rows[0], []) : null;
  },

  async upvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const currentQuestion = await getGroupQuestionFromSupabase(id, normalizedVoterId);

    if (!currentQuestion) {
      return null;
    }

    if (currentQuestion.hasVoted) {
      return currentQuestion;
    }

    await supabaseFetch<SupabaseGroupQuestionVoteRow[]>(
      `/qwt_group_question_votes?select=${groupQuestionVoteSelect()}`,
      {
        method: "POST",
        body: JSON.stringify({
          question_id: id,
          voter_id: normalizedVoterId,
        }),
        prefer: "return=representation",
      },
    ).catch((error) => {
      if (error instanceof SupabaseStoreError && error.status === 409) {
        return [];
      }

      throw error;
    });

    return getGroupQuestionFromSupabase(id, normalizedVoterId);
  },

  async unvoteGroupQuestion(id, voterId) {
    const normalizedVoterId = validateGroupQuestionVoterId(voterId);
    const currentQuestion = await getGroupQuestionFromSupabase(id, normalizedVoterId);

    if (!currentQuestion) {
      return null;
    }

    if (!currentQuestion.hasVoted) {
      return currentQuestion;
    }

    await supabaseFetch<SupabaseGroupQuestionVoteRow[]>(
      `/qwt_group_question_votes?question_id=eq.${encodeFilterValue(id)}&voter_id=eq.${encodeFilterValue(normalizedVoterId)}&select=${groupQuestionVoteSelect()}`,
      {
        method: "DELETE",
        prefer: "return=representation",
      },
    );

    return getGroupQuestionFromSupabase(id, normalizedVoterId);
  },

  async setGroupQuestionAnswered(id, isAnswered) {
    const timestamp = now();
    const rows = await supabaseFetch<SupabaseGroupQuestionRow[]>(
      `/qwt_group_questions?id=eq.${encodeFilterValue(id)}&select=${groupQuestionSelect()}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          is_answered: isAnswered,
          updated_at: timestamp,
        }),
        prefer: "return=representation",
      },
    );

    return rows[0] ? groupQuestionFromRow(rows[0], []) : null;
  },

  async archiveSessionActivity(code) {
    const session = await getSessionFromSupabase(code);

    if (!session) {
      return null;
    }

    const archivedAt = now();
    const [submissionRows, questionRows] = await Promise.all([
      supabaseFetch<SupabaseSubmissionRow[]>(
        `/qwt_submissions?session_code=eq.${encodeFilterValue(session.code)}&archived_at=is.null&select=${submissionSelect()}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived_at: archivedAt,
            updated_at: archivedAt,
          }),
          prefer: "return=representation",
        },
      ),
      supabaseFetch<SupabaseGroupQuestionRow[]>(
        `/qwt_group_questions?session_code=eq.${encodeFilterValue(session.code)}&archived_at=is.null&select=${groupQuestionSelect()}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived_at: archivedAt,
            updated_at: archivedAt,
          }),
          prefer: "return=representation",
        },
      ),
    ]);

    return {
      archivedAt,
      groupQuestions: questionRows.length,
      submissions: submissionRows.length,
    };
  },

  async unarchiveSessionActivity(code, archivedAt) {
    const session = await getSessionFromSupabase(code);

    if (!session) {
      return null;
    }

    const archiveDate = new Date(archivedAt);

    if (!Number.isFinite(archiveDate.getTime())) {
      throw new Error("Archive timestamp could not be read.");
    }

    const restoredAt = now();
    const archivedAtFilter = encodeFilterValue(archivedAt);
    const [submissionRows, questionRows] = await Promise.all([
      supabaseFetch<SupabaseSubmissionRow[]>(
        `/qwt_submissions?session_code=eq.${encodeFilterValue(session.code)}&archived_at=eq.${archivedAtFilter}&select=${submissionSelect()}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived_at: null,
            updated_at: restoredAt,
          }),
          prefer: "return=representation",
        },
      ),
      supabaseFetch<SupabaseGroupQuestionRow[]>(
        `/qwt_group_questions?session_code=eq.${encodeFilterValue(session.code)}&archived_at=eq.${archivedAtFilter}&select=${groupQuestionSelect()}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            archived_at: null,
            updated_at: restoredAt,
          }),
          prefer: "return=representation",
        },
      ),
    ]);

    return {
      archivedAt,
      groupQuestions: questionRows.length,
      submissions: submissionRows.length,
    };
  },
};
