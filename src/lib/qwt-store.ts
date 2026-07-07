import { localStore } from "./qwt-local-store";
import { supabaseStore } from "./qwt-supabase-store";
import {
  normalizeSessionCode,
  normalizeStudentName,
  type QwtStore,
  type SessionPatch,
  type SubmissionPatch,
} from "./qwt-store-model";

export { normalizeSessionCode, normalizeStudentName };
export type {
  QwtStore,
  DrawingData,
  DrawingPoint,
  DrawingStroke,
  Session,
  SessionPatch,
  SessionStats,
  Submission,
  SubmissionPatch,
  SubmissionStatus,
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

export async function getOrCreateSession(code: string) {
  return getStore().getOrCreateSession(code);
}

export async function listSessions() {
  return getStore().listSessions();
}

export async function updateSession(code: string, patch: SessionPatch) {
  return getStore().updateSession(code, patch);
}

export async function listSubmissions(
  code: string,
  options: { minutes?: number; includeHidden?: boolean } = {},
) {
  return getStore().listSubmissions(code, options);
}

export async function addSubmission(
  code: string,
  text: string,
  drawingData?: unknown,
  studentName?: string,
) {
  return getStore().addSubmission(code, text, drawingData, studentName);
}

export async function updateSubmission(id: string, patch: SubmissionPatch) {
  return getStore().updateSubmission(id, patch);
}

export async function getSessionStats(code: string) {
  return getStore().getSessionStats(code);
}
