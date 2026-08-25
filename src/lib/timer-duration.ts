export const TIMER_MAX_SECONDS = 3600;
export const SESSION_TIMER_MIN_SECONDS = 1;
export const POLL_TIMER_MIN_SECONDS = 5;

export const QUICK_TIMER_ADJUSTMENTS = [-5, -15, -30, 5, 15, 30];

export function formatTimerSeconds(totalSeconds: number) {
  const boundedSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(boundedSeconds / 60);
  const seconds = boundedSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function parseTimerDurationInput(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes(":")) {
    const seconds = Number(trimmed);
    return Number.isFinite(seconds) ? seconds : null;
  }

  const parts = trimmed.split(":");

  if (parts.length !== 2) {
    return null;
  }

  const minutes = Number(parts[0] || "0");
  const seconds = Number(parts[1]);

  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    seconds >= 60
  ) {
    return null;
  }

  return minutes * 60 + seconds;
}

export function clampTimerSeconds(seconds: number, minSeconds: number) {
  const sourceSeconds = Number.isFinite(seconds) ? Math.round(seconds) : 30;

  return Math.min(TIMER_MAX_SECONDS, Math.max(minSeconds, sourceSeconds));
}

export function sanitizeTimerDraftValue(value: string) {
  const stripped = value.replace(/[^0-9:]/g, "");
  const firstColon = stripped.indexOf(":");

  if (firstColon === -1) {
    return stripped.slice(0, 6);
  }

  return (
    stripped.slice(0, firstColon) +
    ":" +
    stripped.slice(firstColon + 1).replace(/:/g, "").slice(0, 2)
  );
}
