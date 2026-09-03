export type MossproutGardenIntroBeat = {
  actionLabel: string;
  icon: string;
  line: string;
};

export const MOSSPROUT_GARDEN_INTRO_BEATS: readonly MossproutGardenIntroBeat[] = [
  {
    line: 'You said you wanted something to grow. So I made a little Seed from it.',
    actionLabel: 'Continue',
    icon: 'arrow.right',
  },
  {
    line: 'It belongs to you. Let’s find it a place in my Garden.',
    actionLabel: 'Plant the Seed',
    icon: 'leaf.fill',
  },
] as const;

export function mossproutGardenIntroBeat(index: number) {
  const safeIndex = Math.max(0, Math.min(Math.floor(index), MOSSPROUT_GARDEN_INTRO_BEATS.length - 1));
  return MOSSPROUT_GARDEN_INTRO_BEATS[safeIndex]!;
}
