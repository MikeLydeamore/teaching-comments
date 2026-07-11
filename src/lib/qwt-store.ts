import { localStore } from "./qwt-local-store";
import { supabaseStore } from "./qwt-supabase-store";
import {
  normalizeSpaceCode,
  normalizeSessionCode,
  normalizeStudentName,
  type QwtStore,
  type SessionPatch,
  type SubmissionPatch,
} from "./qwt-store-model";

export { normalizeSessionCode, normalizeStudentName };
export { normalizeSpaceCode };
export type {
  QwtStore,
  DrawingData,
  DrawingPoint,
  DrawingStroke,
  GifData,
  GroupQuestion,
  ArchiveSessionActivityResult,
  PromptHistoryItem,
  QuestionBankItem,
  Session,
  SessionPatch,
  SessionStats,
  Submission,
  SubmissionPatch,
  SubmissionStatus,
  TeacherSpace,
  TeacherSpaceSummary,
} from "./qwt-store-model";

function shouldUseSupabaseStore() {
  const requestedBackend = process.env.QWT_STORAGE_BACKEND?.toLowerCase();

  if (requestedBackend === "supabase") {
    return true;
  }

  if (requestedBackend === "local") {
    return false;
  }

  return Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getStore(): QwtStore {
  return shouldUseSupabaseStore() ? supabaseStore : localStore;
}

export async function getSession(code: string) {
  return getStore().getSession(code);
}

export async function createTeacherSpace(
  code: string,
  name: string,
  pinHash: string,
) {
  return getStore().createTeacherSpace(code, name, pinHash);
}

export async function getTeacherSpace(code: string) {
  return getStore().getTeacherSpace(code);
}

export async function listTeacherSpaces() {
  return getStore().listTeacherSpaces();
}

export async function updateTeacherSpacePinHash(
  code: string,
  pinHash: string,
) {
  return getStore().updateTeacherSpacePinHash(code, pinHash);
}

export async function getSessionInSpace(spaceCode: string, code: string) {
  return getStore().getSessionInSpace(spaceCode, code);
}

export async function getOrCreateSession(code: string) {
  return getStore().getOrCreateSession(code);
}

export async function getOrCreateSessionInSpace(spaceCode: string, code: string) {
  return getStore().getOrCreateSessionInSpace(spaceCode, code);
}

export async function listSessions(spaceCode?: string) {
  return getStore().listSessions(spaceCode);
}

export async function updateSession(code: string, patch: SessionPatch) {
  return getStore().updateSession(code, patch);
}

export async function listPromptHistory(code: string) {
  return getStore().listPromptHistory(code);
}

export async function listSubmissions(
  code: string,
  options: {
    minutes?: number;
    includeHidden?: boolean;
    includeArchived?: boolean;
    promptHistoryId?: string;
  } = {},
) {
  return getStore().listSubmissions(code, options);
}

export async function addSubmission(
  code: string,
  text: string,
  drawingData?: unknown,
  gifData?: unknown,
  studentName?: string,
) {
  return getStore().addSubmission(code, text, drawingData, gifData, studentName);
}

export async function updateSubmission(id: string, patch: SubmissionPatch) {
  return getStore().updateSubmission(id, patch);
}

export async function getSessionStats(code: string) {
  return getStore().getSessionStats(code);
}

export async function listQuestionBank(code: string) {
  return getStore().listQuestionBank(code);
}

export async function addQuestionToBank(code: string, text: string, title?: string) {
  return getStore().addQuestionToBank(code, text, title);
}

export async function deleteQuestionFromBank(id: string) {
  return getStore().deleteQuestionFromBank(id);
}

export async function listGroupQuestions(
  code: string,
  voterId?: string,
  options: { includeAnswered?: boolean; includeArchived?: boolean } = {},
) {
  return getStore().listGroupQuestions(code, voterId, options);
}

export async function addGroupQuestion(
  code: string,
  text: string,
  studentName?: string,
) {
  return getStore().addGroupQuestion(code, text, studentName);
}

export async function upvoteGroupQuestion(id: string, voterId: string) {
  return getStore().upvoteGroupQuestion(id, voterId);
}

export async function unvoteGroupQuestion(id: string, voterId: string) {
  return getStore().unvoteGroupQuestion(id, voterId);
}

export async function setGroupQuestionAnswered(id: string, isAnswered: boolean) {
  return getStore().setGroupQuestionAnswered(id, isAnswered);
}

export async function archiveSessionActivity(code: string) {
  return getStore().archiveSessionActivity(code);
}

export async function unarchiveSessionActivity(code: string, archivedAt: string) {
  return getStore().unarchiveSessionActivity(code, archivedAt);
}
