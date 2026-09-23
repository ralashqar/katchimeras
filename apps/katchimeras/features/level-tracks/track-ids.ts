import { regionLadder } from '@/constants/island-campaigns/ladder';
import { islandCampaignById } from '@/constants/island-campaigns/registry';
import { SLEEPING_GROVE_RUNGS } from '@/constants/regions/sleeping-grove';
import type { EncounterGrade } from '@/types/encounter';
import type { EncounterClearRecord } from '@/types/merge-world';

/**
 * A level track is one tile's set of levels: a friend's island (keyed by its
 * campaign), Mossprout's Sleeping Grove, or the Daily Mist. Every level
 * belongs to exactly one track; stars, replays and milestones are counted per
 * track. Pure lookups here, so the engine and the sheet agree.
 */
export const GROVE_TRACK_ID = 'sleeping-grove';
export const DAILY_TRACK_ID = 'daily-mist';

export function trackIdFor(missionId: string, campaignId?: string | null): string {
  if (campaignId) return campaignId;
  if (missionId.startsWith(`${GROVE_TRACK_ID}:`)) return GROVE_TRACK_ID;
  if (missionId.startsWith('daily:')) return DAILY_TRACK_ID;
  return missionId;
}

/** The levels a track holds, in order (the Daily Mist's change every day, so it keeps no stars). */
export function trackMissionIds(trackId: string): string[] {
  if (trackId === GROVE_TRACK_ID) return SLEEPING_GROVE_RUNGS.flatMap((rung) => rung.kind === 'encounter' ? [rung.mission.id] : []);
  const campaign = islandCampaignById.get(trackId);
  return campaign ? regionLadder(campaign).map((rung) => rung.mission.id) : [];
}

/** Stars are the grade, read as the player sees it: Cleared one, Bright two, Perfect three. */
export const gradeStars = (grade: EncounterGrade | null | undefined): number => grade === 'perfect' ? 3 : grade === 'bright' ? 2 : grade === 'cleared' ? 1 : 0;

export function trackStars(clears: Readonly<Record<string, EncounterClearRecord>>, trackId: string): { stars: number; maxStars: number } {
  const ids = trackMissionIds(trackId);
  return { stars: ids.reduce((sum, id) => sum + gradeStars(clears[id]?.bestGrade), 0), maxStars: ids.length * 3 };
}

/** The Katchimera whose Wisp collection a track's pack joins: the one who played there last, else Mossprout. */
export function trackPackFamily(clears: Readonly<Record<string, EncounterClearRecord>>, trackId: string, packFamilies: readonly string[]): string {
  let latest: EncounterClearRecord | null = null;
  for (const id of trackMissionIds(trackId)) {
    const clear = clears[id];
    if (clear && (!latest || clear.firstClearedAt >= latest.firstClearedAt)) latest = clear;
  }
  return latest && packFamilies.includes(latest.lastKatchimeraId) ? latest.lastKatchimeraId : 'mossprout';
}
