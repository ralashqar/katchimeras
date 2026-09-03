export type MossproutGardenIntroBeat = {
  actionLabel: string;
  icon: string;
  line: string;
};

export const MOSSPROUT_GARDEN_INTRO_BEATS: readonly MossproutGardenIntroBeat[] = [
  { line: 'This Seed came from what you shared.', actionLabel: 'Continue', icon: 'arrow.right' },
] as const;

export function mossproutGardenIntroBeat(index: number) {
  const safeIndex = Math.max(0, Math.min(Math.floor(index), MOSSPROUT_GARDEN_INTRO_BEATS.length - 1));
  return MOSSPROUT_GARDEN_INTRO_BEATS[safeIndex]!;
}
