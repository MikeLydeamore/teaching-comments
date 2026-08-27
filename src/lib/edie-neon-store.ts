import "server-only";

import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_PROMPT,
  DEFAULT_SPACE_CODE,
  applySessionPatch,
  defaultSubmissionViewSettings,
  assertSubmissionHasContent,
  assertSubmissionUsesEnabledInputs,
  calculateStats,
  normalizeSessionCode,
  normalizeSpaceCode,
  normalizeStudentName,
  normalizeSubmissionImageData,
  normalizeSubmissionPatch,
  normalizeSubmissionViewSettingsPatch,
  now,
  QuestionBankConflictError,
  titleFromCode,
  validateGroupQuestionText,
  validateGroupQuestionVoterId,
  validateCorrectOptionIndexes,
  validatePollDefinition,
  validatePollExtension,
  validatePollParticipantId,
  validatePollQuestionDefinition,
  validatePollQuestionTitle,
  validateQuestionText,
  validateQuestionTitle,
  validateSubmissionContent,
  validateTeacherSpaceName,
  validateTeacherSpacePinHash,
  type GroupQuestion,
  type PollOption,
  type PromptHistoryItem,
  type EdieStore,
  type Session,
  type SessionPoll,
  type Submission,
  type SubmissionViewSettings,
  type SubmissionViewSettingsPatch,
  type TeacherSpace,
} from "./edie-store-model";

type Row = Record<string, unknown>;

export class NeonStoreError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "NeonStoreError";
    this.status = status;
  }
}

function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) {
    throw new Error(
      "Neon storage is enabled, but DATABASE_URL is not set.",
    );
  }
  return value;
}

/** Kept lazy so local builds never require a Neon connection. */
function sql() {
  return neon(databaseUrl());
}

function databaseError(error: unknown): never {
  if (error instanceof NeonStoreError) throw error;
  const source = error as { code?: unknown; message?: unknown; detail?: unknown };
  const code = typeof source?.code === "string" ? source.code : "";
  const message =
    typeof source?.detail === "string"
      ? source.detail
      : typeof source?.message === "string"
        ? source.message
        : "The database request failed.";
  throw new NeonStoreError(message, code === "23505" ? 409 : 500);
}

async function query<T extends Row = Row>(text: string, values: unknown[] = []) {
  try {
    return (await sql().query(text, values)) as T[];
  } catch (error) {
    databaseError(error);
  }
}

function text(row: Row, key: string) {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return value == null ? "" : String(value);
}

function nullableText(row: Row, key: string) {
  const value = row[key];
  if (value instanceof Date) return value.toISOString();
  return value == null ? null : String(value);
}

function jsonParameter(value: unknown) {
  return value == null ? null : JSON.stringify(value);
}

function bool(row: Row, key: string, fallback = false) {
  const value = row[key];
  return typeof value === "boolean" ? value : fallback;
}

function number(row: Row, key: string, fallback = 0) {
  const value = row[key];
  return typeof value === "number" ? value : fallback;
}

function json(row: Row, key: string): unknown {
  const value = row[key];
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function sessionFromRow(row: Row): Session {
  return {
    id: text(row, "id"), code: text(row, "code"),
    spaceCode: text(row, "space_code") || DEFAULT_SPACE_CODE,
    title: text(row, "title"), prompt: text(row, "prompt"),
    isOpen: bool(row, "is_open", true),
    groupQuestionsScreeningEnabled: bool(row, "group_questions_screening_enabled"),
    submissionsScreeningEnabled: bool(row, "submissions_screening_enabled"),
    textInputEnabled: bool(row, "text_input_enabled", true),
    gifInputEnabled: bool(row, "gif_input_enabled", true),
    drawingInputEnabled: bool(row, "drawing_input_enabled", true),
    imageInputEnabled: bool(row, "image_input_enabled", true),
    createdAt: text(row, "created_at"),
    promptUpdatedAt: text(row, "prompt_updated_at") || text(row, "created_at"),
    timerDurationSeconds: number(row, "timer_duration_seconds"),
    timerEndsAt: nullableText(row, "timer_ends_at"),
  };
}

function teacherSpaceFromRow(row: Row): TeacherSpace {
  return { code: text(row, "code"), name: text(row, "name"), pinHash: text(row, "pin_hash"), createdAt: text(row, "created_at") };
}

function submissionFromRow(row: Row): Submission {
  return {
    id: text(row, "id"), sessionCode: text(row, "session_code"),
    studentName: text(row, "student_name") || "Anonymous", text: text(row, "text"),
    drawingData: json(row, "drawing_data") as Submission["drawingData"],
    gifData: json(row, "gif_data") as Submission["gifData"],
    imageData: normalizeSubmissionImageData(json(row, "image_data")),
    status: text(row, "status") as Submission["status"], starred: bool(row, "starred"),
    flagged: bool(row, "flagged"), version: number(row, "version", 1),
    archivedAt: nullableText(row, "archived_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"),
  };
}

function promptHistoryFromRow(row: Row): PromptHistoryItem {
  return { id: text(row, "id"), sessionCode: text(row, "session_code"), prompt: text(row, "prompt"), startedAt: text(row, "started_at"), endedAt: nullableText(row, "ended_at") };
}

function submissionViewSettingsFromRow(row: Row): SubmissionViewSettings {
  return {
    sessionCode: text(row, "session_code"),
    promptHistoryId: nullableText(row, "prompt_history_id"),
    minutes: number(row, "minutes", 3) as SubmissionViewSettings["minutes"],
    sortOrder: text(row, "sort_order") as SubmissionViewSettings["sortOrder"],
    starredOnly: bool(row, "starred_only"),
    revision: number(row, "revision"),
    updatedAt: text(row, "updated_at"),
  };
}

function groupQuestionFromRow(row: Row, voterId = ""): GroupQuestion {
  return {
    id: text(row, "id"), sessionCode: text(row, "session_code"), studentName: text(row, "student_name") || "Anonymous", text: text(row, "text"),
    isAnswered: bool(row, "is_answered"), isVisible: bool(row, "is_visible", true), voteCount: number(row, "vote_count"), hasVoted: voterId ? bool(row, "has_voted") : false,
    archivedAt: nullableText(row, "archived_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"),
  };
}

function pollFromRow(row: Row): SessionPoll {
  const options = json(row, "options");
  return {
    id: text(row, "id"), sessionCode: text(row, "session_code"), question: text(row, "question"), selectionMode: text(row, "selection_mode") as SessionPoll["selectionMode"],
    options: (Array.isArray(options) ? options : []) as PollOption[], correctOptionIds: (json(row, "correct_option_ids") as string[]) ?? [], solutionRevealed: bool(row, "solution_revealed"), status: text(row, "status") as SessionPoll["status"], durationSeconds: number(row, "duration_seconds"),
    startedAt: text(row, "started_at"), endsAt: text(row, "ends_at"), endedAt: nullableText(row, "ended_at"), createdAt: text(row, "created_at"), updatedAt: text(row, "updated_at"),
  };
}

const SESSION_COLUMNS = "id, code, space_code, title, prompt, is_open, group_questions_screening_enabled, submissions_screening_enabled, text_input_enabled, gif_input_enabled, drawing_input_enabled, image_input_enabled, created_at, prompt_updated_at, timer_duration_seconds, timer_ends_at";
const SUBMISSION_COLUMNS = "id, session_code, student_name, text, drawing_data, gif_data, image_data, status, starred, flagged, version, archived_at, created_at, updated_at";
const GROUP_QUESTION_COLUMNS = "id, session_code, student_name, text, is_answered, is_visible, archived_at, created_at, updated_at";
const POLL_QUESTION_COLUMNS = "id, session_code, title, question, selection_mode, options, correct_option_indexes, created_at, updated_at";
const POLL_COLUMNS = "id, session_code, question, selection_mode, options, correct_option_ids, solution_revealed, status, duration_seconds, started_at, ends_at, ended_at, created_at, updated_at";
const SUBMISSION_VIEW_SETTINGS_COLUMNS = "session_code, prompt_history_id, minutes, sort_order, starred_only, revision, updated_at";

async function getSessionRow(code: string) {
  const normalized = normalizeSessionCode(code);
  if (!normalized) return null;
  return (await query(`SELECT ${SESSION_COLUMNS} FROM edie_sessions WHERE id = $1 LIMIT 1`, [normalized]))[0] ?? null;
}

async function getSessionInSpaceRow(spaceCode: string, code: string) {
  const space = normalizeSpaceCode(spaceCode); const session = normalizeSessionCode(code);
  if (!space || !session) return null;
  return (await query(`SELECT ${SESSION_COLUMNS} FROM edie_sessions WHERE space_code = $1 AND code = $2 LIMIT 1`, [space, session]))[0] ?? null;
}

async function getPollRow(id: string) {
  return (await query(`SELECT ${POLL_COLUMNS} FROM edie_polls WHERE id = $1 LIMIT 1`, [id]))[0] ?? null;
}

async function ensurePromptHistory(session: Session) {
  await query(
    `INSERT INTO edie_prompt_history (session_code, prompt, started_at)
     SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM edie_prompt_history WHERE session_code = $1)`,
    [session.id, session.prompt, session.promptUpdatedAt || session.createdAt],
  );
}

async function groupQuestionRow(id: string, voterId = "") {
  const rows = await query(
    `SELECT q.*, COUNT(v.question_id)::integer AS vote_count,
      CASE WHEN $2::text = '' THEN false ELSE BOOL_OR(v.voter_id = $2) END AS has_voted
     FROM edie_group_questions q LEFT JOIN edie_group_question_votes v ON v.question_id = q.id
     WHERE q.id = $1 GROUP BY q.id`, [id, voterId],
  );
  return rows[0] ?? null;
}

export const neonStore: EdieStore = {
  async createTeacherSpace(code, name, pinHash) {
    const normalized = normalizeSpaceCode(code);
    if (!normalized) throw new Error("Space code is required.");
    try {
      const rows = await query("INSERT INTO edie_teacher_spaces (code, name, pin_hash) VALUES ($1, $2, $3) RETURNING code, name, pin_hash, created_at", [normalized, validateTeacherSpaceName(name), validateTeacherSpacePinHash(pinHash)]);
      return teacherSpaceFromRow(rows[0]);
    } catch (error) {
      if (error instanceof NeonStoreError && error.status === 409) throw new Error("That space code already exists.");
      throw error;
    }
  },
  async getTeacherSpace(code) {
    const normalized = normalizeSpaceCode(code); if (!normalized) return null;
    const rows = await query("SELECT code, name, pin_hash, created_at FROM edie_teacher_spaces WHERE code = $1 LIMIT 1", [normalized]);
    return rows[0] ? teacherSpaceFromRow(rows[0]) : null;
  },
  async listTeacherSpaces() {
    const rows = await query("SELECT code, name, created_at FROM edie_teacher_spaces ORDER BY name ASC");
    return rows.map((row) => ({ code: text(row, "code"), name: text(row, "name"), createdAt: text(row, "created_at") }));
  },
  async updateTeacherSpacePinHash(code, pinHash) {
    const normalized = normalizeSpaceCode(code); if (!normalized) return null;
    const rows = await query("UPDATE edie_teacher_spaces SET pin_hash = $2 WHERE code = $1 RETURNING code, name, pin_hash, created_at", [normalized, validateTeacherSpacePinHash(pinHash)]);
    return rows[0] ? teacherSpaceFromRow(rows[0]) : null;
  },
  async getSession(code) { const row = await getSessionRow(code); return row ? sessionFromRow(row) : null; },
  async getSessionInSpace(spaceCode, code) { const row = await getSessionInSpaceRow(spaceCode, code); return row ? sessionFromRow(row) : null; },
  async getOrCreateSession(code) {
    const result = await this.getOrCreateSessionInSpace(DEFAULT_SPACE_CODE, code);
    if (!result) throw new Error("Default teaching space is missing.");
    return result;
  },
  async getOrCreateSessionInSpace(spaceCode, code) {
    const spaceCodeNormalized = normalizeSpaceCode(spaceCode) || DEFAULT_SPACE_CODE;
    const codeNormalized = normalizeSessionCode(code) || "demo-lecture";
    const space = await query("SELECT 1 FROM edie_teacher_spaces WHERE code = $1", [spaceCodeNormalized]);
    if (!space.length) return null;
    const timestamp = now(); const id = randomUUID();
    const rows = await query(
      `INSERT INTO edie_sessions (id, code, space_code, title, prompt, is_open, group_questions_screening_enabled, submissions_screening_enabled, text_input_enabled, gif_input_enabled, drawing_input_enabled, image_input_enabled, created_at, prompt_updated_at, timer_duration_seconds, timer_ends_at)
       VALUES ($1,$2,$3,$4,$5,true,false,false,true,true,true,true,$6,$6,0,NULL)
       ON CONFLICT (space_code, code) DO UPDATE SET code = EXCLUDED.code RETURNING ${SESSION_COLUMNS}`,
      [id, codeNormalized, spaceCodeNormalized, titleFromCode(codeNormalized) || "Ed.ie Session", DEFAULT_PROMPT, timestamp],
    );
    const result = sessionFromRow(rows[0]); await ensurePromptHistory(result); return result;
  },
  async listSessions(spaceCode) {
    const normalized = spaceCode ? normalizeSpaceCode(spaceCode) : "";
    const rows = normalized ? await query(`SELECT ${SESSION_COLUMNS} FROM edie_sessions WHERE space_code = $1 ORDER BY created_at DESC`, [normalized]) : await query(`SELECT ${SESSION_COLUMNS} FROM edie_sessions ORDER BY created_at DESC`);
    return rows.map(sessionFromRow);
  },
  async updateSession(code, patch) {
    const row = await getSessionRow(code); if (!row) return null;
    const current = sessionFromRow(row); const next = applySessionPatch(current, patch); const changed = current.prompt !== next.prompt;
    if (changed) await ensurePromptHistory(current);
    const rows = await query(
      `UPDATE edie_sessions SET title=$2,prompt=$3,prompt_updated_at=$4,timer_duration_seconds=$5,timer_ends_at=$6,is_open=$7,group_questions_screening_enabled=$8,submissions_screening_enabled=$9,text_input_enabled=$10,gif_input_enabled=$11,drawing_input_enabled=$12,image_input_enabled=$13 WHERE id=$1 RETURNING ${SESSION_COLUMNS}`,
      [current.id,next.title,next.prompt,next.promptUpdatedAt,next.timerDurationSeconds,next.timerEndsAt,next.isOpen,next.groupQuestionsScreeningEnabled,next.submissionsScreeningEnabled,next.textInputEnabled,next.gifInputEnabled,next.drawingInputEnabled,next.imageInputEnabled],
    );
    if (changed) {
      await query(
        `WITH closed AS (UPDATE edie_prompt_history SET ended_at=$2 WHERE session_code=$1 AND ended_at IS NULL)
         INSERT INTO edie_prompt_history (session_code,prompt,started_at) VALUES ($1,$3,$2)`,
        [current.id, next.promptUpdatedAt, next.prompt],
      );
    }
    return rows[0] ? sessionFromRow(rows[0]) : null;
  },
  async getSubmissionViewSettings(code) {
    const row = await getSessionRow(code);
    if (!row) return null;
    const session = sessionFromRow(row);
    const rows = await query(
      `SELECT ${SUBMISSION_VIEW_SETTINGS_COLUMNS} FROM edie_submission_view_settings WHERE session_code = $1 LIMIT 1`,
      [session.id],
    );
    return rows[0]
      ? submissionViewSettingsFromRow(rows[0])
      : defaultSubmissionViewSettings(session.id, session.createdAt);
  },
  async updateSubmissionViewSettings(
    code,
    patch: SubmissionViewSettingsPatch,
  ) {
    const row = await getSessionRow(code);
    if (!row) return null;
    const session = sessionFromRow(row);
    const normalizedPatch = normalizeSubmissionViewSettingsPatch(patch);

    if (normalizedPatch.promptHistoryId) {
      const promptRows = await query(
        "SELECT 1 FROM edie_prompt_history WHERE session_code = $1 AND id = $2 LIMIT 1",
        [session.id, normalizedPatch.promptHistoryId],
      );
      if (!promptRows.length) {
        throw new Error("Prompt filter does not belong to this session.");
      }
    }

    const timestamp = now();
    const rows = await query(
      `INSERT INTO edie_submission_view_settings AS current_settings
         (session_code, prompt_history_id, minutes, sort_order, starred_only, revision, updated_at)
       VALUES ($1, $2, $3, $4, $5, 1, $6)
       ON CONFLICT (session_code) DO UPDATE SET
         prompt_history_id = CASE WHEN $7 THEN EXCLUDED.prompt_history_id ELSE current_settings.prompt_history_id END,
         minutes = CASE WHEN $8 THEN EXCLUDED.minutes ELSE current_settings.minutes END,
         sort_order = CASE WHEN $9 THEN EXCLUDED.sort_order ELSE current_settings.sort_order END,
         starred_only = CASE WHEN $10 THEN EXCLUDED.starred_only ELSE current_settings.starred_only END,
         revision = current_settings.revision + 1,
         updated_at = EXCLUDED.updated_at
       RETURNING ${SUBMISSION_VIEW_SETTINGS_COLUMNS}`,
      [
        session.id,
        normalizedPatch.promptHistoryId ?? null,
        normalizedPatch.minutes ?? 3,
        normalizedPatch.sortOrder ?? "newest",
        normalizedPatch.starredOnly ?? false,
        timestamp,
        "promptHistoryId" in normalizedPatch,
        "minutes" in normalizedPatch,
        "sortOrder" in normalizedPatch,
        "starredOnly" in normalizedPatch,
      ],
    );
    return rows[0] ? submissionViewSettingsFromRow(rows[0]) : null;
  },
  async listPromptHistory(code) {
    const row = await getSessionRow(code); if (!row) return [];
    const session = sessionFromRow(row); await ensurePromptHistory(session);
    return (await query("SELECT id, session_code, prompt, started_at, ended_at FROM edie_prompt_history WHERE session_code = $1 ORDER BY started_at DESC", [session.id])).map(promptHistoryFromRow);
  },
  async listSubmissions(code, options = {}) {
    const sessionCode = normalizeSessionCode(code) || "demo-lecture";
    let history: PromptHistoryItem | null = null;
    if (options.promptHistoryId) {
      const rows = await query("SELECT id, session_code, prompt, started_at, ended_at FROM edie_prompt_history WHERE session_code = $1 AND id = $2", [sessionCode, options.promptHistoryId]);
      history = rows[0] ? promptHistoryFromRow(rows[0]) : null; if (!history) return [];
    }
    const clauses = ["session_code = $1"]; const values: unknown[] = [sessionCode];
    if (!options.includeHidden) clauses.push("status <> 'hidden'");
    if (!options.includeArchived) clauses.push("archived_at IS NULL");
    const cutoff = typeof options.minutes === "number" && options.minutes > 0 ? new Date(Date.now() - options.minutes * 60000) : null;
    const start = history ? new Date(history.startedAt) : null; const after = cutoff && start ? new Date(Math.max(cutoff.getTime(), start.getTime())) : cutoff ?? start;
    if (after) { values.push(after.toISOString()); clauses.push(`created_at >= $${values.length}`); }
    if (history?.endedAt) { values.push(history.endedAt); clauses.push(`created_at < $${values.length}`); }
    return (await query(`SELECT ${SUBMISSION_COLUMNS} FROM edie_submissions WHERE ${clauses.join(" AND ")} ORDER BY created_at DESC`, values)).map(submissionFromRow);
  },
  async addSubmission(code, input) {
    const imageData = normalizeSubmissionImageData(input.imageData); const content = validateSubmissionContent(input.text, input.drawingData, input.gifData, imageData);
    const row = await getSessionRow(code); if (!row) throw new Error("This Ed.ie session does not exist. Check the code from your teacher.");
    const session = sessionFromRow(row); if (!session.isOpen) throw new Error("This Ed.ie session is closed.");
    assertSubmissionUsesEnabledInputs(session, content.text, content.drawingData, content.gifData, imageData);
    const timestamp = now(); const rows = await query(
      `INSERT INTO edie_submissions (id,session_code,student_name,text,drawing_data,gif_data,image_data,status,starred,flagged,version,archived_at,created_at,updated_at)
       VALUES (COALESCE($1::uuid,gen_random_uuid()),$2,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,$8,false,false,1,NULL,$9,$9) RETURNING ${SUBMISSION_COLUMNS}`,
      [input.id ?? null,session.id,normalizeStudentName(input.studentName ?? ""),content.text,jsonParameter(content.drawingData),jsonParameter(content.gifData),jsonParameter(imageData),session.submissionsScreeningEnabled ? "hidden" : "visible",timestamp]);
    return submissionFromRow(rows[0]);
  },
  async getSubmission(id) { const rows = await query(`SELECT ${SUBMISSION_COLUMNS} FROM edie_submissions WHERE id = $1::uuid`, [id]); return rows[0] ? submissionFromRow(rows[0]) : null; },
  async updateSubmission(sessionCode, id, patch) {
    const currentRows = await query(`SELECT ${SUBMISSION_COLUMNS} FROM edie_submissions WHERE id=$1::uuid AND session_code=$2`, [id,sessionCode]); if (!currentRows[0]) return null;
    const current = submissionFromRow(currentRows[0]); const normalized = normalizeSubmissionPatch(patch); const hasText = "text" in normalized; const nextText = hasText ? normalized.text ?? "" : current.text;
    assertSubmissionHasContent(nextText,current.drawingData,current.gifData,current.imageData);
    const rows = await query(`UPDATE edie_submissions SET text=CASE WHEN $3 THEN $4 ELSE text END,status=COALESCE($5,status),starred=COALESCE($6,starred),flagged=COALESCE($7,flagged),version=version+1,updated_at=$8 WHERE id=$1::uuid AND session_code=$2 RETURNING ${SUBMISSION_COLUMNS}`,[id,sessionCode,hasText,nextText,normalized.status ?? null,typeof normalized.starred === "boolean" ? normalized.starred : null,typeof normalized.flagged === "boolean" ? normalized.flagged : null,now()]);
    return rows[0] ? submissionFromRow(rows[0]) : null;
  },
  async getSessionStats(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture"; return calculateStats((await query(`SELECT ${SUBMISSION_COLUMNS} FROM edie_submissions WHERE session_code=$1 AND archived_at IS NULL`,[sessionCode])).map(submissionFromRow)); },
  async listQuestionBank(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture"; return (await query("SELECT id,session_code,title,text,created_at,updated_at FROM edie_question_bank WHERE session_code=$1 ORDER BY title ASC",[sessionCode])).map((r)=>({id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title")||text(r,"text"),text:text(r,"text"),createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")})); },
  async addQuestionToBank(code, question, title) {
    const row = await getSessionRow(code); if (!row) return null;
    const timestamp = now();
    try {
      const rows = await query("INSERT INTO edie_question_bank (session_code,title,text,created_at,updated_at) VALUES ($1,$2,$3,$4,$4) RETURNING id,session_code,title,text,created_at,updated_at", [text(row,"id"),validateQuestionTitle(title,question),validateQuestionText(question),timestamp]);
      const r = rows[0];
      return {id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title"),text:text(r,"text"),createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")};
    } catch (error) {
      if (error instanceof NeonStoreError && error.status === 409) {
        throw new QuestionBankConflictError("That question is already in the bank.");
      }
      throw error;
    }
  },
  async getQuestionFromBank(id) { const rows=await query("SELECT id,session_code,title,text,created_at,updated_at FROM edie_question_bank WHERE id=$1::uuid",[id]); const r=rows[0]; return r?{id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title")||text(r,"text"),text:text(r,"text"),createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")}:null; },
  async deleteQuestionFromBank(sessionCode,id) { return (await query("DELETE FROM edie_question_bank WHERE id=$1::uuid AND session_code=$2 RETURNING id",[id,sessionCode])).length>0; },
  async listPollQuestionBank(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture"; return (await query(`SELECT ${POLL_QUESTION_COLUMNS} FROM edie_poll_question_bank WHERE session_code=$1 ORDER BY title ASC`,[sessionCode])).map((r)=>({id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title")||text(r,"question"),question:text(r,"question"),selectionMode:text(r,"selection_mode") as "single"|"multiple",options:(json(r,"options") as string[])??[],correctOptionIndexes:(json(r,"correct_option_indexes") as number[])??[],createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")})); },
  async addPollQuestionToBank(code,title,question,selectionMode,options,correctOptionIndexes) {
    const row=await getSessionRow(code); if(!row)return null;
    const d=validatePollQuestionDefinition(question,selectionMode,options);
    const correctIndexes=validateCorrectOptionIndexes(d.selectionMode,d.optionLabels,correctOptionIndexes);
    const timestamp=now();
    try {
      const rows=await query(`INSERT INTO edie_poll_question_bank (session_code,title,question,selection_mode,options,correct_option_indexes,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7) RETURNING ${POLL_QUESTION_COLUMNS}`,[text(row,"id"),validatePollQuestionTitle(title,d.question),d.question,d.selectionMode,JSON.stringify(d.optionLabels),JSON.stringify(correctIndexes),timestamp]);
      const r=rows[0];
      return {id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title"),question:text(r,"question"),selectionMode:text(r,"selection_mode") as "single"|"multiple",options:(json(r,"options") as string[])??[],correctOptionIndexes:(json(r,"correct_option_indexes") as number[])??[],createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")};
    } catch (error) {
      if (error instanceof NeonStoreError && error.status === 409) {
        throw new QuestionBankConflictError("That poll question is already in the bank.");
      }
      throw error;
    }
  },
  async updatePollQuestionInBank(code,id,question,selectionMode,options,correctOptionIndexes) {
    const sessionCode=normalizeSessionCode(code)||"demo-lecture";
    const d=validatePollQuestionDefinition(question,selectionMode,options);
    const correctIndexes=validateCorrectOptionIndexes(d.selectionMode,d.optionLabels,correctOptionIndexes);
    try {
      const rows=await query(`UPDATE edie_poll_question_bank SET question=$3,selection_mode=$4,options=$5::jsonb,correct_option_indexes=$6::jsonb,updated_at=$7 WHERE id=$1::uuid AND session_code=$2 RETURNING ${POLL_QUESTION_COLUMNS}`,[id,sessionCode,d.question,d.selectionMode,JSON.stringify(d.optionLabels),JSON.stringify(correctIndexes),now()]);
      const r=rows[0];
      return r?{id:text(r,"id"),sessionCode:text(r,"session_code"),title:text(r,"title")||text(r,"question"),question:text(r,"question"),selectionMode:text(r,"selection_mode") as "single"|"multiple",options:(json(r,"options") as string[])??[],correctOptionIndexes:(json(r,"correct_option_indexes") as number[])??[],createdAt:text(r,"created_at"),updatedAt:text(r,"updated_at")}:null;
    } catch (error) {
      if (error instanceof NeonStoreError && error.status === 409) {
        throw new QuestionBankConflictError("That poll question is already in the bank.");
      }
      throw error;
    }
  },
  async deletePollQuestionFromBank(code,id) { return (await query("DELETE FROM edie_poll_question_bank WHERE id=$1::uuid AND session_code=$2 RETURNING id",[id,normalizeSessionCode(code)||"demo-lecture"])).length>0; },
  async listGroupQuestions(code,voterId,options={}) { const sessionCode=normalizeSessionCode(code)||"demo-lecture"; const voter=voterId?validateGroupQuestionVoterId(voterId):""; const values:unknown[]=[sessionCode,voter]; const clauses=["q.session_code=$1"]; if(!options.includeAnswered)clauses.push("q.is_answered=false");if(!options.includeHidden)clauses.push("q.is_visible=true");if(!options.includeArchived)clauses.push("q.archived_at IS NULL"); const rows=await query(`SELECT q.*,COUNT(v.question_id)::integer AS vote_count,CASE WHEN $2::text='' THEN false ELSE BOOL_OR(v.voter_id=$2) END AS has_voted FROM edie_group_questions q LEFT JOIN edie_group_question_votes v ON v.question_id=q.id WHERE ${clauses.join(" AND ")} GROUP BY q.id ORDER BY q.is_answered ASC, COUNT(v.question_id) DESC, q.created_at DESC`,values);return rows.map((r)=>groupQuestionFromRow(r,voter)); },
  async addGroupQuestion(code,question,studentName) { const s=await getSessionRow(code);if(!s)return null;const session=sessionFromRow(s);if(!session.isOpen)throw new Error("This session is closed.");const timestamp=now();const rows=await query(`INSERT INTO edie_group_questions (session_code,student_name,text,is_answered,is_visible,archived_at,created_at,updated_at) VALUES ($1,$2,$3,false,$4,NULL,$5,$5) RETURNING ${GROUP_QUESTION_COLUMNS}`,[session.id,normalizeStudentName(studentName??""),validateGroupQuestionText(question),!session.groupQuestionsScreeningEnabled,timestamp]);return groupQuestionFromRow({...rows[0],vote_count:0}); },
  async getGroupQuestion(id) { const r=await groupQuestionRow(id);return r?groupQuestionFromRow(r):null; },
  async upvoteGroupQuestion(id,voterId) { const voter=validateGroupQuestionVoterId(voterId);const current=await groupQuestionRow(id,voter);if(!current)return null;const session=await getSessionRow(text(current,"session_code"));if(!sessionFromRow(session??{}).isOpen)throw new Error("This session is closed.");await query("INSERT INTO edie_group_question_votes (question_id,voter_id) VALUES ($1::uuid,$2) ON CONFLICT (question_id,voter_id) DO NOTHING",[id,voter]);const result=await groupQuestionRow(id,voter);return result?groupQuestionFromRow(result,voter):null; },
  async unvoteGroupQuestion(id,voterId) { const voter=validateGroupQuestionVoterId(voterId);const current=await groupQuestionRow(id,voter);if(!current)return null;const session=await getSessionRow(text(current,"session_code"));if(!sessionFromRow(session??{}).isOpen)throw new Error("This session is closed.");await query("DELETE FROM edie_group_question_votes WHERE question_id=$1::uuid AND voter_id=$2",[id,voter]);const result=await groupQuestionRow(id,voter);return result?groupQuestionFromRow(result,voter):null; },
  async setGroupQuestionAnswered(sessionCode,id,isAnswered) { const rows=await query(`UPDATE edie_group_questions SET is_answered=$3,updated_at=$4 WHERE id=$1::uuid AND session_code=$2 RETURNING ${GROUP_QUESTION_COLUMNS}`,[id,sessionCode,isAnswered,now()]);return rows[0]?groupQuestionFromRow({...rows[0],vote_count:0}):null; },
  async setGroupQuestionVisible(sessionCode,id,isVisible) { const rows=await query(`UPDATE edie_group_questions SET is_visible=$3,updated_at=$4 WHERE id=$1::uuid AND session_code=$2 RETURNING ${GROUP_QUESTION_COLUMNS}`,[id,sessionCode,isVisible,now()]);return rows[0]?groupQuestionFromRow({...rows[0],vote_count:0}):null; },
  async getActivePoll(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture";const rows=await query(`SELECT ${POLL_COLUMNS} FROM edie_polls WHERE session_code=$1 AND status='active' ORDER BY started_at DESC LIMIT 1`,[sessionCode]);return rows[0]?pollFromRow(rows[0]):null; },
  async getLatestPoll(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture";const rows=await query(`SELECT ${POLL_COLUMNS} FROM edie_polls WHERE session_code=$1 ORDER BY started_at DESC LIMIT 1`,[sessionCode]);return rows[0]?pollFromRow(rows[0]):null; },
  async getPollHistory(code) { const sessionCode=normalizeSessionCode(code)||"demo-lecture";const polls=(await query(`SELECT ${POLL_COLUMNS} FROM edie_polls WHERE session_code=$1 ORDER BY started_at DESC`,[sessionCode])).map(pollFromRow);return Promise.all(polls.map(async poll=>{const responses=await query("SELECT option_ids FROM edie_poll_responses WHERE poll_id=$1::uuid",[poll.id]);return {poll,responseCount:responses.length,options:poll.options.map(option=>({...option,responseCount:responses.filter(r=>Array.isArray(json(r,"option_ids"))&&(json(r,"option_ids") as unknown[]).includes(option.id)).length}))};})); },
  async getPoll(id) { const r=await getPollRow(id);return r?pollFromRow(r):null; },
  async startPoll(code,question,selectionMode,labels,correctOptionIndexes,durationSeconds) { const sessionRow=await getSessionRow(code);if(!sessionRow)return null;const session=sessionFromRow(sessionRow);if(!session.isOpen)throw new Error("This session is closed.");const d=validatePollDefinition(question,selectionMode,labels,durationSeconds);const timestamp=now();const options=d.optionLabels.map((label,position)=>({id:randomUUID(),label,position}));const correctOptionIds=validateCorrectOptionIndexes(d.selectionMode,d.optionLabels,correctOptionIndexes).map((index)=>options[index].id);const rows=await query(`WITH ended AS (UPDATE edie_polls SET status='ended',ended_at=$2,updated_at=$2 WHERE session_code=$1 AND status='active') INSERT INTO edie_polls (session_code,question,selection_mode,options,correct_option_ids,solution_revealed,status,duration_seconds,started_at,ends_at,created_at,updated_at) VALUES ($1,$3,$4,$5::jsonb,$6::jsonb,false,'active',$7,$2,$8,$2,$2) RETURNING ${POLL_COLUMNS}`,[session.id,timestamp,d.question,d.selectionMode,JSON.stringify(options),JSON.stringify(correctOptionIds),d.durationSeconds,new Date(Date.parse(timestamp)+d.durationSeconds*1000).toISOString()]);return pollFromRow(rows[0]); },
  async extendPoll(id,seconds) { const extension=validatePollExtension(seconds);const row=await getPollRow(id);if(!row)return null;const poll=pollFromRow(row);if(poll.status!=="active")throw new Error("This poll has been ended.");if(Date.parse(poll.endsAt)<=Date.now())throw new Error("This poll timer has ended.");const base=Math.max(Date.now(),Date.parse(poll.endsAt));const rows=await query(`UPDATE edie_polls SET duration_seconds=duration_seconds+$2,ends_at=$3,updated_at=$4 WHERE id=$1::uuid AND status='active' RETURNING ${POLL_COLUMNS}`,[id,extension,new Date(base+extension*1000).toISOString(),now()]);return rows[0]?pollFromRow(rows[0]):null; },
  async endPoll(id) { const timestamp=now();const rows=await query(`UPDATE edie_polls SET status='ended',ended_at=$2,updated_at=$2 WHERE id=$1::uuid RETURNING ${POLL_COLUMNS}`,[id,timestamp]);return rows[0]?pollFromRow(rows[0]):null; },
  async revealPollSolution(id) { const rows=await query(`UPDATE edie_polls SET solution_revealed=true,updated_at=$2 WHERE id=$1::uuid RETURNING ${POLL_COLUMNS}`,[id,now()]);return rows[0]?pollFromRow(rows[0]):null; },
  async getPollResponse(pollId,participantId) { const participant=validatePollParticipantId(participantId);const rows=await query("SELECT poll_id,participant_id,option_ids,updated_at FROM edie_poll_responses WHERE poll_id=$1::uuid AND participant_id=$2",[pollId,participant]);const r=rows[0];return r?{pollId:text(r,"poll_id"),participantId:text(r,"participant_id"),optionIds:(json(r,"option_ids") as string[])??[],updatedAt:text(r,"updated_at")}:null; },
  async savePollResponse(pollId,participantId,optionIds) { const participant=validatePollParticipantId(participantId);const pollRow=await getPollRow(pollId);if(!pollRow)return null;const poll=pollFromRow(pollRow);const session=await getSessionRow(poll.sessionCode);if(!sessionFromRow(session??{}).isOpen)throw new Error("This session is closed.");if(poll.status!=="active"||poll.solutionRevealed||Date.parse(poll.endsAt)<=Date.now())throw new Error("This poll is no longer accepting answers.");const selected=[...new Set(optionIds)];const allowed=new Set(poll.options.map(o=>o.id));if(selected.some(id=>!allowed.has(id)))throw new Error("That poll answer could not be found.");if(poll.selectionMode==="single"&&selected.length!==1)throw new Error("Choose one answer for this poll.");const rows=await query("INSERT INTO edie_poll_responses (poll_id,participant_id,option_ids,updated_at) VALUES ($1::uuid,$2,$3::jsonb,$4) ON CONFLICT (poll_id,participant_id) DO UPDATE SET option_ids=EXCLUDED.option_ids,updated_at=EXCLUDED.updated_at RETURNING poll_id,participant_id,option_ids,updated_at",[poll.id,participant,JSON.stringify(selected),now()]);const r=rows[0];return {pollId:text(r,"poll_id"),participantId:text(r,"participant_id"),optionIds:(json(r,"option_ids") as string[])??[],updatedAt:text(r,"updated_at")}; },
  async getPollResults(id) { const pollRow=await getPollRow(id);if(!pollRow)return null;const poll=pollFromRow(pollRow);const responses=await query("SELECT option_ids FROM edie_poll_responses WHERE poll_id=$1::uuid",[id]);return {poll,responseCount:responses.length,options:poll.options.map(option=>({...option,responseCount:responses.filter(r=>Array.isArray(json(r,"option_ids"))&&(json(r,"option_ids") as unknown[]).includes(option.id)).length}))}; },
  async archiveSessionActivity(code) { const row=await getSessionRow(code);if(!row)return null;const timestamp=now();const counts=await query(`WITH submissions AS (UPDATE edie_submissions SET archived_at=$2,updated_at=$2 WHERE session_code=$1 AND archived_at IS NULL RETURNING 1), questions AS (UPDATE edie_group_questions SET archived_at=$2,updated_at=$2 WHERE session_code=$1 AND archived_at IS NULL RETURNING 1) SELECT (SELECT count(*)::integer FROM submissions) AS submissions,(SELECT count(*)::integer FROM questions) AS questions`,[text(row,"id"),timestamp]);return {archivedAt:timestamp,submissions:number(counts[0],"submissions"),groupQuestions:number(counts[0],"questions")}; },
  async unarchiveSessionActivity(code,archivedAt) { const row=await getSessionRow(code);if(!row)return null;if(!Number.isFinite(Date.parse(archivedAt)))throw new Error("Archive timestamp could not be read.");const timestamp=now();const counts=await query(`WITH submissions AS (UPDATE edie_submissions SET archived_at=NULL,updated_at=$3 WHERE session_code=$1 AND archived_at=$2::timestamptz RETURNING 1), questions AS (UPDATE edie_group_questions SET archived_at=NULL,updated_at=$3 WHERE session_code=$1 AND archived_at=$2::timestamptz RETURNING 1) SELECT (SELECT count(*)::integer FROM submissions) AS submissions,(SELECT count(*)::integer FROM questions) AS questions`,[text(row,"id"),archivedAt,timestamp]);return {archivedAt,submissions:number(counts[0],"submissions"),groupQuestions:number(counts[0],"questions")}; },
};
