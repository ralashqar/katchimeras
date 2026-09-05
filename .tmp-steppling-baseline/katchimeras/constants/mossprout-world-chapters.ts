export type MossproutWorldChapter = {
  id: 'quiet-patch' | 'returning-pond' | 'memory-nursery' | 'heartwood';
  number: 1 | 2 | 3 | 4;
  title: string;
  theme: string;
  firstActiveDay: number;
  finalActiveDay: number;
  region: string;
};

export const MOSSPROUT_WORLD_CHAPTERS: readonly MossproutWorldChapter[] = [
  { id: 'quiet-patch', number: 1, title: 'The Quiet Patch', theme: 'Noticing', firstActiveDay: 1, finalActiveDay: 7, region: 'Garden clearing' },
  { id: 'returning-pond', number: 2, title: 'The Returning Pond', theme: 'Curiosity', firstActiveDay: 8, finalActiveDay: 14, region: 'Old pond' },
  { id: 'memory-nursery', number: 3, title: 'The Memory Nursery', theme: 'Patterns', firstActiveDay: 15, finalActiveDay: 21, region: 'Forgotten greenhouse' },
  { id: 'heartwood', number: 4, title: 'Heartwood', theme: 'Growth', firstActiveDay: 22, finalActiveDay: 28, region: 'Ancient grove' },
] as const;

export function mossproutWorldChapterForActiveDays(activeDays: number): MossproutWorldChapter {
  const day = Math.max(1, activeDays);
  return MOSSPROUT_WORLD_CHAPTERS.find((chapter) => day <= chapter.finalActiveDay)
    ?? MOSSPROUT_WORLD_CHAPTERS[MOSSPROUT_WORLD_CHAPTERS.length - 1];
}
