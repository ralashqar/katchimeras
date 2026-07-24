import type {
  DayBackgroundSceneId,
  DaySkySnapshot,
  SkyMoodId,
} from '@/types/home';

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

export function resolveDayBackgroundSceneId(sky: DaySkySnapshot): DayBackgroundSceneId {
  switch (sky.weather) {
    case 'stormy':
      return 'storm';
    case 'snowy':
    case 'foggy':
      return 'mist_cold';
    case 'rainy':
    case 'overcast':
      return 'rain_overcast';
    case 'hot':
      return 'radiant_golden';
    case 'clear':
    case 'partly_cloudy':
      return SCENE_FOR_MOOD[sky.mood];
  }
}
