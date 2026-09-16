import type { CompanionDailyMomentConfig } from '@/types/companion-daily';
import { companionDailyConfig } from '@/constants/companion-daily/registry';
import { companionLifeActivityId } from '@/utils/companion-life-activity-ids';
import { loadCompanionLifeActivities } from '@/utils/companion-life-activity-storage';

/**
 * A Daily Moment: one tap, once a day, kept apart from the chapters. It is
 * a life activity like a photo or a noticed thing (the same store, the same
 * small Bond, the same journal entry), and a journey line can read what the
 * player said today through `{{today}}`.
 */
export function dailyMomentConfig(familyId: string): CompanionDailyMomentConfig | null {
  return companionDailyConfig(familyId)?.moment ?? null;
}

/** What the player called today, in the friend's words, or null before they have. */
export function todayMomentAnswer(familyId: string, dayId: string): string | null {
  const completion = loadCompanionLifeActivities(familyId).completions[companionLifeActivityId(familyId, dayId, 'moment')];
  return completion?.status === 'complete' ? completion.answer : null;
}
