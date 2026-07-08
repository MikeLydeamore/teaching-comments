import type { Submission } from "./qwt-store-model";

export type PollResult = [response: string, count: number];

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "for",
  "in",
  "is",
  "it",
  "no",
  "not",
  "of",
  "or",
  "so",
  "that",
  "the",
  "there",
  "this",
  "to",
  "with",
]);

export function normalizePollResponse(text: string) {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function tokenizeWordCloudText(text: string) {
  return normalizePollResponse(text).match(/[\p{L}\p{N}][\p{L}\p{N}'.-]*/gu) ?? [];
}

function isInformativeWord(word: string) {
  return !stopWords.has(word) && (word.length >= 3 || /\p{N}/u.test(word));
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

export function responseWordCounts(
  submissions: Pick<Submission, "text">[],
  limit = 60,
): PollResult[] {
  const counts = new Map<string, number>();

  for (const submission of submissions) {
    const words = tokenizeWordCloudText(submission.text);
    const informativeWords = words.filter(isInformativeWord);

    for (const word of informativeWords.length ? informativeWords : words) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}
