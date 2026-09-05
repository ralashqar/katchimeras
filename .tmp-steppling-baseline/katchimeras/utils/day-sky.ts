import type {
  DaySkySnapshot,
  DaySkyPolicy,
  SkyMoodId,
  SkyWeatherId,
  StoredHomeDayRecord,
  WeatherCondition,
} from '@/types/home';
import { clampAtmosphereUnit, type ExpressiveAtmospherePresetId } from '@/utils/atmosphere';
import { resolveDayAtmosphere } from '@/utils/day-atmosphere';

export const SKY_WEATHER_OPTIONS: readonly { id: SkyWeatherId; label: string }[] = [
  { id: 'clear', label: 'Clear' },
  { id: 'partly_cloudy', label: 'Partly cloudy' },
  { id: 'overcast', label: 'Overcast' },
  { id: 'foggy', label: 'Foggy' },
  { id: 'rainy', label: 'Rainy' },
  { id: 'snowy', label: 'Snowy' },
  { id: 'stormy', label: 'Stormy' },
  { id: 'hot', label: 'Hot' },
] as const;

export const SKY_MOOD_OPTIONS: readonly { id: SkyMoodId; label: string }[] = [
  { id: 'neutral', label: 'Neutral' },
  { id: 'radiant', label: 'Radiant' },
  { id: 'celebratory', label: 'Celebratory' },
  { id: 'garden', label: 'Garden' },
  { id: 'autumn', label: 'Autumn' },
  { id: 'hearth', label: 'Hearth' },
  { id: 'twilight', label: 'Twilight' },
  { id: 'inspired', label: 'Inspired' },
  { id: 'journey', label: 'Journey' },
  { id: 'connected', label: 'Connected' },
  { id: 'reflective', label: 'Reflective' },
] as const;

const MOOD_FOR_EXPRESSIVE_PRESET: Record<ExpressiveAtmospherePresetId, SkyMoodId> = {
  none: 'neutral',
  celebration_drift: 'celebratory',
  golden_motes: 'radiant',
  fireflies: 'twilight',
  petal_drift: 'garden',
  falling_leaves: 'autumn',
  dandelion_seeds: 'garden',
  cozy_embers: 'hearth',
  dream_wisps: 'twilight',
  idea_sparks: 'inspired',
  journey_breeze: 'journey',
  memory_shimmer: 'reflective',
  social_ribbons: 'connected',
  quiet_dust: 'reflective',
};

export function skyWeatherForDay(
  condition: WeatherCondition | null | undefined,
  tempMaxC?: number,
): SkyWeatherId {
  if ((tempMaxC ?? 0) >= 27 && (!condition || condition === 'clear' || condition === 'partly_cloudy')) {
    return 'hot';
  }
  switch (condition) {
    case 'partly_cloudy': return 'partly_cloudy';
    case 'cloudy': return 'overcast';
    case 'fog': return 'foggy';
    case 'rain': return 'rainy';
    case 'snow': return 'snowy';
    case 'storm': return 'stormy';
    case 'clear':
    default:
      return 'clear';
  }
}

export function skyMoodForExpressivePreset(
  preset: ExpressiveAtmospherePresetId | null | undefined,
): SkyMoodId {
  return MOOD_FOR_EXPRESSIVE_PRESET[preset ?? 'none'];
}

export function deriveDaySkySnapshot(
  day: StoredHomeDayRecord | null | undefined,
): DaySkySnapshot {
  const atmosphere = resolveDayAtmosphere(day);
  return {
    intensity: clampAtmosphereUnit(atmosphere.expressive?.intensity ?? 0),
    mood: skyMoodForExpressivePreset(atmosphere.expressive?.preset as ExpressiveAtmospherePresetId | undefined),
    seed: atmosphere.seed,
    version: 1,
    weather: skyWeatherForDay(day?.weather?.condition, day?.weather?.tempMaxC),
  };
}

export function resolveDaySky(
  day: StoredHomeDayRecord | null | undefined,
): DaySkySnapshot {
  if (
    day?.state === 'hatched'
    && day.skyPolicy !== 'historical_adaptive'
    && day.sky?.version === 1
  ) {
    return day.sky;
  }
  return deriveDaySkySnapshot(day);
}

export function inferDaySkyPolicy(
  day: StoredHomeDayRecord,
): DaySkyPolicy | null {
  if (day.skyPolicy) return day.skyPolicy;
  if (day.card?.provenance === 'live_hatch') return 'live_frozen';
  if (day.card?.provenance === 'legacy_backfill') return 'historical_adaptive';
  return null;
}

export function reconcileDaySkySnapshot(
  day: StoredHomeDayRecord,
): StoredHomeDayRecord {
  if (day.state !== 'hatched' || !day.creature) return day;
  const skyPolicy = inferDaySkyPolicy(day);
  if (!skyPolicy) return day;

  if (skyPolicy === 'live_frozen') {
    return day.sky?.version === 1
      ? { ...day, skyPolicy }
      : { ...day, sky: deriveDaySkySnapshot(day), skyPolicy };
  }

  // Historical reconstruction gets richer asynchronously. Do not seal a
  // partial photo-only snapshot before the generated reflection lands.
  if (day.creature.reflectionSource !== 'generated') {
    return { ...day, sky: undefined, skyPolicy };
  }

  return {
    ...day,
    sky: deriveDaySkySnapshot(day),
    skyPolicy,
  };
}
