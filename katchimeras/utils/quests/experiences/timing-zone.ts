export type TimingRating = 'perfect' | 'good' | 'early' | 'late';
export type TimingTap = { hit: boolean; rating: TimingRating; normalizedOffset: number };

export function scoreTimingTap(position: number, zoneCenter: number, zoneWidth: number): TimingTap {
  const offset = position - zoneCenter;
  const distance = Math.abs(offset);
  const half = zoneWidth / 2;
  if (distance <= half * 0.35) return { hit: true, rating: 'perfect', normalizedOffset: offset };
  if (distance <= half) return { hit: true, rating: 'good', normalizedOffset: offset };
  return { hit: false, rating: offset < 0 ? 'early' : 'late', normalizedOffset: offset };
}

export function timingAccuracy(hits: number, attempts: number): number {
  return attempts ? hits / attempts : 0;
}

