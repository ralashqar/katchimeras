import type {
  CardAtmosphereLayer,
  CardEnvironmentLayer,
  DailyCreatureCard,
  LocalCreatureRecord,
  StoredHomeDayRecord,
} from '@/types/home';
import { resolveDayBackgroundSceneId } from '@/utils/day-background-scene-id';
import { resolveDayAtmosphere } from '@/utils/day-atmosphere';
import { skyMoodForExpressivePreset } from '@/utils/day-sky';
import type { ExpressiveAtmospherePresetId } from '@/utils/atmosphere';

export const DAILY_CARD_SECONDARY_MIN_PROBABILITY = 0.12;
export const DAILY_CARD_WEATHER_MAX_STRENGTH = 0.25;

export function resolveDailyCardEnvironment(
  creature: LocalCreatureRecord
): CardEnvironmentLayer {
  const secondary = creature.fieldEchoes?.find(
    (echo) => echo.visualKey !== creature.visualKey
      && echo.probability >= DAILY_CARD_SECONDARY_MIN_PROBABILITY
  );
  if (!secondary) {
    return {
      visualKey: creature.visualKey,
      source: 'primary_fallback',
      candidateProfileId: creature.encounterProfileId,
      probability: creature.pickProbability ?? null,
    };
  }
  return {
    visualKey: secondary.visualKey,
    source: 'secondary_candidate',
    candidateProfileId: secondary.speciesId,
    probability: secondary.probability,
  };
}

export function resolveDailyCardAtmosphere(
  day: StoredHomeDayRecord
): CardAtmosphereLayer {
  const plan = resolveDayAtmosphere(day);
  const expressivePreset = plan.expressive?.preset as ExpressiveAtmospherePresetId | undefined;
  const mood = skyMoodForExpressivePreset(expressivePreset);
  const weatherModifier = day.weather
    ? {
        condition: day.weather.condition,
        strength: DAILY_CARD_WEATHER_MAX_STRENGTH,
      }
    : undefined;
  return {
    sceneId: resolveDayBackgroundSceneId({
      intensity: plan.expressive?.intensity ?? 0,
      mood,
      seed: plan.seed,
      version: 1,
      // Journal meaning owns the authored plate. Physical weather is rendered
      // as the capped modifier above, so it cannot replace that mood family.
      weather: 'clear',
    }),
    mood,
    intensity: plan.expressive?.intensity ?? 0,
    seed: plan.seed,
    source: 'journal_weather_blend',
    weatherModifier,
  };
}

export function resolveDailyCardSkySceneId(
  card: DailyCreatureCard
): CardAtmosphereLayer['sceneId'] {
  if (card.scene?.atmosphere) return card.scene.atmosphere.sceneId;
  const backdrop = card.scene?.backdrop ?? card.treatment.backdrop;
  const weather = card.scene?.weather
    ?? (backdrop === 'rain' || backdrop === 'storm' || backdrop === 'snow'
      ? backdrop
      : 'clear');

  if (weather === 'storm') return 'storm';
  if (weather === 'rain') return 'rain_overcast';
  if (weather === 'snow') return 'mist_cold';

  const lighting = card.scene?.lighting;
  if (lighting === 'night' || backdrop === 'night') return 'twilight_reflective';
  if (lighting === 'golden_hour' || lighting === 'dawn' || backdrop === 'dawn') {
    return 'radiant_golden';
  }

  if (backdrop === 'home' || backdrop === 'cafe') return 'autumn_hearth';
  if (backdrop === 'nature' || backdrop === 'meadow') return 'garden_bloom';
  if (backdrop === 'city') return 'inspired_journey';
  return 'clear_day';
}
