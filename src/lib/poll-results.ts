import type { Submission } from "./qwt-store-model";

export type PollResult = [response: string, count: number];

export function normalizePollResponse(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

export function responseCounts(
  submissions: Pick<Submission, "text">[],
): PollResult[] {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    const response = normalizePollResponse(submission.text);

    if (response) {
      counts.set(response, (counts.get(response) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
