export function formatGameCurrency(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  if (safe < 1_000) return String(safe);
  if (safe < 1_000_000) return `${(safe / 1_000).toFixed(safe < 10_000 ? 1 : 0)}k`;
  return `${(safe / 1_000_000).toFixed(safe < 10_000_000 ? 1 : 0)}m`;
}
