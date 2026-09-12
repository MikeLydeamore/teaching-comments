export const STUDENT_PRESENCE_HEARTBEAT_INTERVAL_MS = 10_000;

export function studentPresenceHeartbeatIsDue(
  lastHeartbeatAt: number | null,
  currentTime: number,
) {
  return (
    lastHeartbeatAt === null ||
    currentTime - lastHeartbeatAt >= STUDENT_PRESENCE_HEARTBEAT_INTERVAL_MS
  );
}
