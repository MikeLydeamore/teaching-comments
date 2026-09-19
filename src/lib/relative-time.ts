const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatTimeAgo(value: string, now = Date.now()) {
  const timestamp = new Date(value).getTime();

  if (!Number.isFinite(timestamp)) {
    return "just now";
  }

  const elapsed = Math.max(0, now - timestamp);

  if (elapsed < MINUTE_MS) {
    return "just now";
  }

  if (elapsed < HOUR_MS) {
    const minutes = Math.floor(elapsed / MINUTE_MS);
    return `${minutes} min ago`;
  }

  if (elapsed < DAY_MS) {
    const hours = Math.floor(elapsed / HOUR_MS);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(elapsed / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
