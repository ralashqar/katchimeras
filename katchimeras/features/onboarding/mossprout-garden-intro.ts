export type MossproutGardenIntroBeat = {
  actionLabel: string;
  icon: string;
  line: string;
};

export const MOSSPROUT_GARDEN_INTRO_BEATS: readonly MossproutGardenIntroBeat[] = [
  {
    line: 'Thank you for telling me. Can I share something too?',
    actionLabel: 'Of course',
    icon: 'bubble.left.fill',
  },
  {
    line: 'This Garden used to be bright and full of little friends.',
    actionLabel: 'Continue',
    icon: 'arrow.right',
  },
  {
    line: 'But it grew wild, and they stopped visiting.',
    actionLabel: 'Continue',
    icon: 'arrow.right',
  },
  {
    line: 'I tried to care for it alone. I couldn\'t keep up.',
    actionLabel: 'Continue',
    icon: 'arrow.right',
  },
  {
    line: 'If we restore it together, maybe my friends will come home.',
    actionLabel: 'Continue',
    icon: 'heart.fill',
  },
  {
    line: 'Come on. I\'ll show you our Garden.',
    actionLabel: 'Show me the Garden',
    icon: 'leaf.fill',
  },
] as const;

export function mossproutGardenIntroBeat(index: number) {
  const safeIndex = Math.max(0, Math.min(Math.floor(index), MOSSPROUT_GARDEN_INTRO_BEATS.length - 1));
  return MOSSPROUT_GARDEN_INTRO_BEATS[safeIndex]!;
}
