export type PromptRevisionOrder = "same" | "newer" | "older";

export function comparePromptRevisions(
  currentRevision: string,
  incomingRevision: string,
): PromptRevisionOrder {
  if (incomingRevision === currentRevision) {
    return "same";
  }

  const currentTime = Date.parse(currentRevision);
  const incomingTime = Date.parse(incomingRevision);

  if (
    Number.isFinite(currentTime) &&
    Number.isFinite(incomingTime) &&
    incomingTime < currentTime
  ) {
    return "older";
  }

  return "newer";
}
