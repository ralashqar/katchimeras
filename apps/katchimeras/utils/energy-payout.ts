/** Split a visual reward across a fixed number of tokens without losing Energy. */
export function splitEnergyAcrossTokens(amount: number, requestedCount = 5): number[] {
  const safeAmount = Math.max(0, Math.round(amount));
  if (safeAmount === 0) return [];
  const count = Math.min(Math.max(1, requestedCount), safeAmount);
  const base = Math.floor(safeAmount / count);
  const remainder = safeAmount % count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}
