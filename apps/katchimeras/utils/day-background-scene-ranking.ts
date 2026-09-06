import type {
  DayBackgroundSceneId,
  DaySkySnapshot,
  SkyMoodId,
  StoredHomeDayRecord,
} from '@/types/home';
import type { DayExpressiveAtmosphereCandidate } from '@/utils/day-atmosphere';
import { resolveDayAtmosphere } from '@/utils/day-atmosphere';
import { resolveDaySky } from '@/utils/day-sky';

export type DayBackgroundSceneCandidate = {
  sceneId: DayBackgroundSceneId;
  score: number;
};

const SCENE_ORDER: readonly DayBackgroundSceneId[] = [
  'clear_day',
  'radiant_golden',
  'celebration_connected',
  'garden_bloom',
  'autumn_hearth',
  'twilight_reflective',
  'inspired_journey',
  'rain_overcast',
  'mist_cold',
  'storm',
] as const;

const SCENE_FOR_MOOD: Record<SkyMoodId, DayBackgroundSceneId> = {
  neutral: 'clear_day',
  radiant: 'radiant_golden',
  celebratory: 'celebration_connected',
  garden: 'garden_bloom',
  autumn: 'autumn_hearth',
  hearth: 'autumn_hearth',
  twilight: 'twilight_reflective',
  inspired: 'inspired_journey',
  journey: 'inspired_journey',
  connected: 'celebration_connected',
  reflective: 'twilight_reflective',
};

const SCENE_FOR_EXPRESSIVE_PRESET: Record<
  DayExpressiveAtmosphereCandidate['preset'],
  DayBackgroundSceneId
> = {
  celebration_drift: 'celebration_connected',
  cozy_embers: 'autumn_hearth',
  dandelion_seeds: 'garden_bloom',
  dream_wisps: 'twilight_reflective',
  falling_leaves: 'autumn_hearth',
  fireflies: 'twilight_reflective',
  golden_motes: 'radiant_golden',
  idea_sparks: 'inspired_journey',
  journey_breeze: 'inspired_journey',
  memory_shimmer: 'twilight_reflective',
  petal_drift: 'garden_bloom',
  quiet_dust: 'twilight_reflective',
  social_ribbons: 'celebration_connected',
};

/**
 * Scores every authored plate for one day. Weather establishes the physical
 * context, journal/reflection signals lift matching art, and the stable day
 * seed gives quiet days a little deterministic visual character.
 */
export function rankDayBackgroundSceneCandidates(
  day: StoredHomeDayRecord | null | undefined,
  sky: DaySkySnapshot = resolveDaySky(day),
): DayBackgroundSceneCandidate[] {
  const scores = new Map<DayBackgroundSceneId, number>();
  for (const sceneId of SCENE_ORDER) {
    const severeWeatherPenalty =
      sceneId === 'storm' ? -12
        : sceneId === 'rain_overcast' || sceneId === 'mist_cold' ? -6
          : 0;
    const quietDayVariation = seededUnit(`${sky.seed}:${sceneId}`) * 2.4;
    scores.set(sceneId, severeWeatherPenalty + quietDayVariation);
  }

  addSceneScore(scores, 'clear_day', 2.4);
  addSceneScore(scores, SCENE_FOR_MOOD[sky.mood], 5 + sky.intensity * 2);

  switch (sky.weather) {
    case 'stormy':
      addSceneScore(scores, 'storm', 26);
      addSceneScore(scores, 'rain_overcast', 15);
      addSceneScore(scores, 'mist_cold', 7);
      break;
    case 'rainy':
      addSceneScore(scores, 'rain_overcast', 18);
      addSceneScore(scores, 'mist_cold', 9);
      break;
    case 'overcast':
      addSceneScore(scores, 'rain_overcast', 14);
      addSceneScore(scores, 'mist_cold', 8);
      break;
    case 'foggy':
    case 'snowy':
      addSceneScore(scores, 'mist_cold', 18);
      addSceneScore(scores, 'rain_overcast', 6);
      break;
    case 'hot':
      addSceneScore(scores, 'radiant_golden', 11);
      addSceneScore(scores, 'clear_day', 2);
      break;
    case 'partly_cloudy':
      addSceneScore(scores, 'clear_day', 1.5);
      break;
    case 'clear':
      addSceneScore(scores, 'clear_day', 2);
      break;
  }

  // A live hatch keeps the mood sealed in its DaySkySnapshot. Historical
  // adaptive days may continue to gain richer runner-up scores as enrichment
  // or retrospective journaling fills in the record.
  if (day?.skyPolicy !== 'live_frozen') {
    for (const candidate of resolveDayAtmosphere(day).expressiveCandidates) {
      addSceneScore(
        scores,
        SCENE_FOR_EXPRESSIVE_PRESET[candidate.preset],
        candidate.score * 1.25,
      );
    }
  }

  return SCENE_ORDER
    .map((sceneId, priority) => ({
      priority,
      sceneId,
      score: scores.get(sceneId) ?? 0,
    }))
    .sort((left, right) => right.score - left.score || left.priority - right.priority)
    .map(({ sceneId, score }) => ({ sceneId, score }));
}

/**
 * Resolves an archive chronologically. The immediately preceding plate is
 * excluded, while plates used two or three days ago receive a softer penalty.
 */
export function resolveDayBackgroundSceneIds(
  days: readonly StoredHomeDayRecord[],
): Map<string, DayBackgroundSceneId> {
  const orderedDays = [...days].sort(
    (left, right) => left.isoDate.localeCompare(right.isoDate) || left.id.localeCompare(right.id),
  );
  const resolved = new Map<string, DayBackgroundSceneId>();
  const recent: DayBackgroundSceneId[] = [];

  for (const day of orderedDays) {
    const ranked = rankDayBackgroundSceneCandidates(day);
    const previous = recent[0];
    const eligible = previous
      ? ranked.filter((candidate) => candidate.sceneId !== previous)
      : ranked;
    const rankedPositions = new Map(
      ranked.map((candidate, index) => [candidate.sceneId, index]),
    );
    const selected = [...eligible].sort((left, right) => {
      const leftAdjusted = left.score - recentUsagePenalty(left.sceneId, recent);
      const rightAdjusted = right.score - recentUsagePenalty(right.sceneId, recent);
      return rightAdjusted - leftAdjusted
        || (rankedPositions.get(left.sceneId) ?? 0) - (rankedPositions.get(right.sceneId) ?? 0);
    })[0] ?? ranked[0];

    resolved.set(day.id, selected.sceneId);
    recent.unshift(selected.sceneId);
    if (recent.length > 3) recent.pop();
  }

  return resolved;
}

function addSceneScore(
  scores: Map<DayBackgroundSceneId, number>,
  sceneId: DayBackgroundSceneId,
  score: number,
): void {
  scores.set(sceneId, (scores.get(sceneId) ?? 0) + score);
}

function recentUsagePenalty(
  sceneId: DayBackgroundSceneId,
  recent: readonly DayBackgroundSceneId[],
): number {
  const age = recent.indexOf(sceneId);
  if (age === 1) return 3.5;
  if (age === 2) return 1.5;
  return 0;
}

function seededUnit(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 0xffffffff;
}
