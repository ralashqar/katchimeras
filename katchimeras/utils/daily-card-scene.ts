import type { DailyCreatureCard, DayBackgroundSceneId } from '@/types/home';

export function resolveDailyCardSkySceneId(
  card: DailyCreatureCard
): DayBackgroundSceneId {
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
