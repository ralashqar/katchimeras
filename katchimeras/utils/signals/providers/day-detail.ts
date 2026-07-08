import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';

// Richer day-record facts (docs/signals-quests-architecture.md): cuisine
// families and studio media the day logged, plus the earliest/latest hour of
// capture activity (drives dawn / late-night quests without any native work —
// derived from moment + food + studio timestamps already on the record).
export const dayDetailProvider: SignalProvider = {
  id: 'day-detail',
  produces: ['food.cuisines', 'studio.media', 'capture.earliestHour', 'capture.latestHour'],
  resolve: ({ today }): Partial<Facts> => {
    if (!today) {
      return { 'food.cuisines': [], 'studio.media': [], 'capture.earliestHour': 'unknown', 'capture.latestHour': 'unknown' };
    }
    const cuisines = Array.from(
      new Set((today.foodMoments ?? []).map((food) => food.cuisine).filter((c): c is NonNullable<typeof c> => !!c))
    );
    const media = Array.from(new Set((today.studioMoments ?? []).map((studio) => studio.mediaType)));

    // Capture hours from every timestamped entry on the day.
    const hours: number[] = [];
    for (const moment of today.capturedMeanings ?? []) hours.push(hourOf(moment.createdAt));
    for (const studio of today.studioMoments ?? []) hours.push(hourOf(studio.createdAt));
    const valid = hours.filter((h) => h >= 0);

    return {
      'food.cuisines': cuisines,
      'studio.media': media,
      'capture.earliestHour': valid.length ? Math.min(...valid) : 'unknown',
      'capture.latestHour': valid.length ? Math.max(...valid) : 'unknown',
    };
  },
};

function hourOf(iso: string): number {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? -1 : new Date(ms).getHours();
}
