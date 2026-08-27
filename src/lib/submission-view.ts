import "server-only";

import {
  getSubmissionViewSettings,
  listPromptHistory,
  listSubmissions,
  toSubmissionDto,
  type Session,
  type PromptHistoryItem,
  type SubmissionDto,
  type SubmissionViewSettings,
} from "@/lib/edie-store";

export type SubmissionViewPayload = {
  promptHistory: PromptHistoryItem[];
  promptOptions: Array<{ id: string; prompt: string }>;
  promptText: string;
  submissions: SubmissionDto[];
  viewSettings: SubmissionViewSettings;
};

export async function getSubmissionViewPayload(
  session: Session,
  includeHidden: boolean,
): Promise<SubmissionViewPayload> {
  const viewSettings = await getSubmissionViewSettings(session.id);

  if (!viewSettings) {
    throw new Error("Session not found.");
  }

  const [promptHistory, submissions] = await Promise.all([
    listPromptHistory(session.id),
    listSubmissions(session.id, {
      includeHidden,
      minutes: viewSettings.minutes,
      promptHistoryId: viewSettings.promptHistoryId ?? undefined,
    }),
  ]);
  const selectedPrompt = promptHistory.find(
    (item) => item.id === viewSettings.promptHistoryId,
  );
  const visibleSubmissions = viewSettings.starredOnly
    ? submissions.filter((submission) => submission.starred)
    : submissions;
  const sortedSubmissions = [...visibleSubmissions].sort((left, right) => {
    const leftTime = new Date(left.createdAt).getTime();
    const rightTime = new Date(right.createdAt).getTime();
    return viewSettings.sortOrder === "oldest"
      ? leftTime - rightTime
      : rightTime - leftTime;
  });

  return {
    promptHistory,
    promptOptions: promptHistory.map(({ id, prompt }) => ({ id, prompt })),
    promptText: selectedPrompt?.prompt ?? session.prompt,
    submissions: sortedSubmissions.map(toSubmissionDto),
    viewSettings,
  };
}
