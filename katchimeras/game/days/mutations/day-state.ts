import type { DayWeather, StoredHomeDayRecord, StoredHomeState } from '@/types/home';

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

    return {
      ...day,
      creature: {
        ...day.creature,
        highlight: generated.highlight,
        reflection: generated.reflection,
        reflectionSource: 'generated',
      },
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
