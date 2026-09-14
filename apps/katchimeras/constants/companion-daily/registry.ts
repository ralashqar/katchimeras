import { hatchableByCompanion } from '@/constants/hatchable-companions/registry';
import type { CompanionDailyConfig } from '@/types/companion-daily';
import { MOSSPROUT_DAILY } from './mossprout';

export { noticePromptForDay, photoThanksForDay } from './rotation';

/** The daily config of any friend with a page: Mossprout's own, or a hatchable friend's `daily` block. */
export function companionDailyConfig(familyId: string): CompanionDailyConfig | null {
  if (familyId === 'mossprout') return MOSSPROUT_DAILY;
  return hatchableByCompanion(familyId)?.daily ?? null;
}
