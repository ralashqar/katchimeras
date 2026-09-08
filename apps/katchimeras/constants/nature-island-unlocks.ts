import type { JourneyDayRecord } from '@/types/relationship-progression';

export const FERNIP_ISLAND_ID = 'wildgrowth-grove' as const;
export const FERNIP_ISLAND_UNLOCK_BEAT_ID = 'quiet-patch:pond-knock';
export const FERNIP_ISLAND_LOCK_REASON = 'Finish Mossprout Journey Day 2, The Pond Knocked Twice, with Fernip.';

export function fernipIslandJourneyUnlocked(relationships: {
  journeyDays: readonly Pick<JourneyDayRecord, 'familyId' | 'beatId' | 'status'>[];
}) {
  return relationships.journeyDays.some((day) => (
    day.familyId === 'mossprout'
    && day.beatId === FERNIP_ISLAND_UNLOCK_BEAT_ID
    && day.status === 'complete'
  ));
}
