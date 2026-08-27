import { localStore } from "./edie-local-store";
import { neonStore } from "./edie-neon-store";
import { selectedStorageBackend } from "./edie-storage-backend";
import {
  normalizeSpaceCode,
  normalizeSessionCode,
  normalizeStudentName,
  type EdieStore,
  type PollSelectionMode,
  type SessionPatch,
  type SubmissionViewSettingsPatch,
  type Submission,
  type SubmissionDto,
  type CreateSubmissionInput,
  type SubmissionPatch,
} from "./edie-store-model";

export { normalizeSessionCode, normalizeStudentName };
export { normalizeSpaceCode };
export type {
  EdieStore,
  DrawingData,
  DrawingPoint,
  DrawingStroke,
  GifData,
  GroupQuestion,
  ParticipantPoll,
  PollOption,
  PollQuestionBankItem,
  PollResponse,
  PollResults,
  PollSelectionMode,
  ArchiveSessionActivityResult,
  PromptHistoryItem,
  QuestionBankItem,
  Session,
  SessionPoll,
  SessionPatch,
  SessionStats,
  Submission,
  SubmissionDto,
  SubmissionImageData,
  SubmissionImageDto,
  CreateSubmissionInput,
  SubmissionPatch,
  SubmissionStatus,
  SubmissionViewMinutes,
  SubmissionViewSettings,
  SubmissionViewSettingsPatch,
  TeacherSpace,
  TeacherSpaceSummary,
} from "./edie-store-model";

// Artificial per-call latency for local testing, e.g. STORE_DELAY_MS=1500 npm run dev.
// Applies to every store method (reads and writes) on any backend.
function getStore(): EdieStore {
  const delayMs = Number(process.env.STORE_DELAY_MS ?? 0);

  const store = (() => {
    switch (selectedStorageBackend()) {
      case "neon": return neonStore;
      default: return localStore;
    }
  })();

  if (!Number.isFinite(delayMs) || delayMs <= 0) {
    return store;
  }

  return new Proxy(store, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);

      if (typeof value !== "function") {
        return value;
      }

      return async (...args: unknown[]) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return value.apply(target, args);
      };
    },
  });
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

export async function getSubmissionViewSettings(code: string) {
  return getStore().getSubmissionViewSettings(code);
}

export async function updateSubmissionViewSettings(
  code: string,
  patch: SubmissionViewSettingsPatch,
) {
  return getStore().updateSubmissionViewSettings(code, patch);
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

export async function addSubmission(code: string, input: CreateSubmissionInput) {
  return getStore().addSubmission(code, input);
}

/** Remove storage identifiers before data crosses a browser/RSC boundary. */
export function toSubmissionDto(submission: Submission): SubmissionDto {
  const { imageData, ...safe } = submission;
  return {
    ...safe,
    image: imageData
      ? {
          contentType: imageData.contentType,
          byteSize: imageData.byteSize,
          url: `/api/submissions/${encodeURIComponent(submission.id)}/image`,
        }
      : null,
  };
}

export async function getSubmission(id: string) {
  return getStore().getSubmission(id);
}

export async function updateSubmission(
  sessionCode: string,
  id: string,
  patch: SubmissionPatch,
) {
  return getStore().updateSubmission(sessionCode, id, patch);
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

export async function getQuestionFromBank(id: string) {
  return getStore().getQuestionFromBank(id);
}

export async function deleteQuestionFromBank(sessionCode: string, id: string) {
  return getStore().deleteQuestionFromBank(sessionCode, id);
}

export async function listPollQuestionBank(code: string) {
  return getStore().listPollQuestionBank(code);
}

export async function addPollQuestionToBank(
  code: string,
  title: string,
  question: string,
  selectionMode: PollSelectionMode,
  options: string[],
  correctOptionIndexes: number[],
) {
  return getStore().addPollQuestionToBank(
    code,
    title,
    question,
    selectionMode,
    options,
    correctOptionIndexes,
  );
}

export async function deletePollQuestionFromBank(code: string, id: string) {
  return getStore().deletePollQuestionFromBank(code, id);
}

export async function updatePollQuestionInBank(
  code: string,
  id: string,
  question: string,
  selectionMode: PollSelectionMode,
  options: string[],
  correctOptionIndexes: number[],
) {
  return getStore().updatePollQuestionInBank(
    code,
    id,
    question,
    selectionMode,
    options,
    correctOptionIndexes,
  );
}

export async function listGroupQuestions(
  code: string,
  voterId?: string,
  options: {
    includeAnswered?: boolean;
    includeArchived?: boolean;
    includeHidden?: boolean;
  } = {},
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

export async function getGroupQuestion(id: string) {
  return getStore().getGroupQuestion(id);
}

export async function upvoteGroupQuestion(id: string, voterId: string) {
  return getStore().upvoteGroupQuestion(id, voterId);
}

export async function unvoteGroupQuestion(id: string, voterId: string) {
  return getStore().unvoteGroupQuestion(id, voterId);
}

export async function setGroupQuestionAnswered(
  sessionCode: string,
  id: string,
  isAnswered: boolean,
) {
  return getStore().setGroupQuestionAnswered(sessionCode, id, isAnswered);
}

export async function setGroupQuestionVisible(
  sessionCode: string,
  id: string,
  isVisible: boolean,
) {
  return getStore().setGroupQuestionVisible(sessionCode, id, isVisible);
}

export async function getActivePoll(code: string) {
  return getStore().getActivePoll(code);
}

export async function getLatestPoll(code: string) {
  return getStore().getLatestPoll(code);
}

export async function getPollHistory(code: string) {
  return getStore().getPollHistory(code);
}

export async function getPoll(id: string) {
  return getStore().getPoll(id);
}

export async function startPoll(
  code: string,
  question: string,
  selectionMode: PollSelectionMode,
  optionLabels: string[],
  correctOptionIndexes: number[],
  durationSeconds: number,
) {
  return getStore().startPoll(
    code,
    question,
    selectionMode,
    optionLabels,
    correctOptionIndexes,
    durationSeconds,
  );
}

export async function extendPoll(id: string, seconds: number) {
  return getStore().extendPoll(id, seconds);
}

export async function endPoll(id: string) {
  return getStore().endPoll(id);
}

export async function restartPoll(id: string) {
  return getStore().restartPoll(id);
}

export async function revealPollSolution(id: string) {
  return getStore().revealPollSolution(id);
}

export async function getPollResponse(pollId: string, participantId: string) {
  return getStore().getPollResponse(pollId, participantId);
}

export async function savePollResponse(
  pollId: string,
  participantId: string,
  optionIds: string[],
) {
  return getStore().savePollResponse(pollId, participantId, optionIds);
}

export async function getPollResults(id: string) {
  return getStore().getPollResults(id);
}

export async function archiveSessionActivity(code: string) {
  return getStore().archiveSessionActivity(code);
}

export async function unarchiveSessionActivity(code: string, archivedAt: string) {
  return getStore().unarchiveSessionActivity(code, archivedAt);
}
