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
  validateQuestionText,
  validateSubmissionContent,
  type DrawingData,
  type GifData,
  type GroupQuestion,
  type QuestionBankItem,
  type QwtStore,
  type Session,
  type Submission,
} from "./qwt-store-model";

type SupabaseSessionRow = {
  code: string;
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

type SupabaseGroupQuestionRow = {
  id: string;
  session_code: string;
  student_name: string;
  text: string;
  is_answered: boolean;
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
  return "code,title,prompt,is_open,created_at,prompt_updated_at,timer_duration_seconds,timer_ends_at";
}

function submissionSelect() {
  return "id,session_code,student_name,text,drawing_data,gif_data,status,starred,flagged,version,created_at,updated_at";
}

function questionBankSelect() {
  return "id,session_code,title,text,created_at,updated_at";
}

function groupQuestionSelect() {
  return "id,session_code,student_name,text,is_answered,created_at,updated_at";
}

function groupQuestionVoteSelect() {
  return "question_id,voter_id,created_at";
}

function sessionFromRow(row: SupabaseSessionRow): Session {
  return {
    code: row.code,
    title: row.title,
    prompt: row.prompt,
    isOpen: row.is_open,
    createdAt: row.created_at,
    promptUpdatedAt: row.prompt_updated_at ?? row.created_at,
    timerDurationSeconds: row.timer_duration_seconds ?? 0,
    timerEndsAt: row.timer_ends_at ?? null,
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
  getSession: getSessionFromSupabase,

  async getOrCreateSession(code) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const existing = await getSessionFromSupabase(sessionCode);

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
          title: titleFromCode(sessionCode) || "Quick Write",
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
        if (session) {
          return [
            {
              code: session.code,
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
      }

      throw error;
    });

    return sessionFromRow(rows[0]);
  },

  async listSessions() {
    const rows = await supabaseFetch<SupabaseSessionRow[]>(
      `/qwt_sessions?select=${sessionSelect()}&order=created_at.desc`,
    );

    return rows.map(sessionFromRow);
  },

  async updateSession(code, patch) {
    const current = await getSessionFromSupabase(code);

    if (!current) {
      return null;
    }

    const next = applySessionPatch(current, patch);
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

    return rows[0] ? sessionFromRow(rows[0]) : null;
  },

  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    const params = new URLSearchParams({
      session_code: `eq.${sessionCode}`,
      select: submissionSelect(),
      order: "created_at.desc",
    });

    if (!options.includeHidden) {
      params.set("status", "neq.hidden");
    }

    if (typeof options.minutes === "number" && options.minutes > 0) {
      params.set(
        "created_at",
        `gte.${new Date(Date.now() - options.minutes * 60 * 1000).toISOString()}`,
      );
    }

    const rows = await supabaseFetch<SupabaseSubmissionRow[]>(
      `/qwt_submissions?${params.toString()}`,
    );

    return rows.map(submissionFromRow);
  },

  async addSubmission(code, text, drawingData, gifData, studentName) {
    const submissionContent = validateSubmissionContent(text, drawingData, gifData);
    const session = await getSessionFromSupabase(code);

    if (!session) {
      throw new Error("This quick write session does not exist. Check the code from your teacher.");
    }

    if (!session.isOpen) {
      throw new Error("This quick write session is closed.");
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
    const rows = await supabaseFetch<SupabaseGroupQuestionRow[]>(
      `/qwt_group_questions?session_code=eq.${encodeFilterValue(sessionCode)}${answeredFilter}&select=${groupQuestionSelect()}&order=created_at.desc`,
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
};
