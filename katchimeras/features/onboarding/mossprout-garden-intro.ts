export type MossproutGardenIntroBeat = {
  actionLabel: string;
  icon: string;
  line: string;
};

export const MOSSPROUT_GARDEN_INTRO_BEATS: readonly MossproutGardenIntroBeat[] = [
  {
    line: 'If we’re growing something, I suppose my Garden should start growing too.',
    actionLabel: 'Continue',
    icon: 'arrow.right',
  },
  {
    line: 'Four tiny Seeds can become one First Bloom. When it grows, this place will remember what we began together.',
    actionLabel: 'Show me the Garden',
    icon: 'leaf.fill',
  },
] as const;

export function mossproutGardenIntroBeat(index: number) {
  const safeIndex = Math.max(0, Math.min(Math.floor(index), MOSSPROUT_GARDEN_INTRO_BEATS.length - 1));
  return MOSSPROUT_GARDEN_INTRO_BEATS[safeIndex]!;
}
