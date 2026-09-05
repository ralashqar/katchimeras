export function formatQuestDuration(durationMs: number): string {
  const totalTenths = Math.max(0, Math.floor(durationMs / 100));
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return minutes > 0
    ? `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`
    : `${seconds}.${tenths}s`;
}
