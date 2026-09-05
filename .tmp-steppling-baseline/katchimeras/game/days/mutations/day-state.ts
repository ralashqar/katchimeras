import type { DayWeather, StoredHomeDayRecord, StoredHomeState } from '@/types/home';
import { updateCardMemorySpark } from '@/utils/daily-card';

export function withDayWeather(state: StoredHomeState, dayId: string, weather: DayWeather): StoredHomeState {
  return mapTodayAndArchived(state, (day) => (day.id === dayId ? { ...day, weather } : day));
}

export function withGeneratedReflection(
  state: StoredHomeState,
  dayId: string,
  generated: { highlight: string; reflection: string }
): StoredHomeState {
  return mapTodayAndArchived(state, (day) => {
    if (day.id !== dayId || !day.creature || day.creature.reflectionSource === 'generated') {
      return day;
    }

    const creature = {
      ...day.creature,
      highlight: generated.highlight,
      reflection: generated.reflection,
      reflectionSource: 'generated' as const,
    };
    return {
      ...day,
      creature,
      card: day.card ? updateCardMemorySpark(day.card, day, creature) : null,
    };
  });
}

function mapTodayAndArchived(
  state: StoredHomeState,
  applyToDay: (day: StoredHomeDayRecord) => StoredHomeDayRecord
): StoredHomeState {
  return {
    ...state,
    today: applyToDay(state.today),
    archivedDays: state.archivedDays.map(applyToDay),
  };
}
