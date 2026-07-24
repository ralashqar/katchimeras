import { TODAY_ATMOSPHERE_BACKGROUND_SOURCES } from '@/constants/today-atmosphere-background-sources.gen';
import type { DayBackgroundSceneId, DaySkySnapshot, StoredHomeDayRecord } from '@/types/home';
import { resolveDayBackgroundSceneIds } from '@/utils/day-background-scene-ranking';
import { resolveDayBackgroundSceneId } from '@/utils/day-background-scene-id';
import { resolveDaySky } from '@/utils/day-sky';

export { resolveDayBackgroundSceneId } from '@/utils/day-background-scene-id';
export {
  rankDayBackgroundSceneCandidates,
  resolveDayBackgroundSceneIds,
} from '@/utils/day-background-scene-ranking';
export type { DayBackgroundSceneCandidate } from '@/utils/day-background-scene-ranking';

export type TodayAtmosphereBackground = {
  id: string;
  sceneId: DayBackgroundSceneId;
  source: (typeof TODAY_ATMOSPHERE_BACKGROUND_SOURCES)[DayBackgroundSceneId]['source'];
};

export function todayAtmosphereBackgroundForSky(
  sky: DaySkySnapshot,
): TodayAtmosphereBackground {
  const sceneId = resolveDayBackgroundSceneId(sky);
  return todayAtmosphereBackgroundForScene(sceneId);
}

export function todayAtmosphereBackgroundForDay(
  day: StoredHomeDayRecord | null | undefined,
  archiveDays: readonly StoredHomeDayRecord[],
): TodayAtmosphereBackground {
  if (!day) return todayAtmosphereBackgroundForSky(resolveDaySky(day));
  const days = archiveDays.some((candidate) => candidate.id === day.id)
    ? archiveDays.map((candidate) => candidate.id === day.id ? day : candidate)
    : [...archiveDays, day];
  const sceneId = resolveDayBackgroundSceneIds(days).get(day.id)
    ?? resolveDayBackgroundSceneId(resolveDaySky(day));
  return todayAtmosphereBackgroundForScene(sceneId);
}

function todayAtmosphereBackgroundForScene(
  sceneId: DayBackgroundSceneId,
): TodayAtmosphereBackground {
  const bundled = TODAY_ATMOSPHERE_BACKGROUND_SOURCES[sceneId];
  return { ...bundled, sceneId };
}
