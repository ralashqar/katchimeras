import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';

// Weather signal provider (docs/signals-quests-architecture.md). NOT new work:
// the day's weather is already read (on-device vision of photos, or a key-less
// coarse forecast — utils/day-weather.ts) and stored as DayWeather. This
// exposes its condition as the `weather.condition` fact so storm/fog creatures
// can quest on it. No weather read → 'unknown'.
export const weatherProvider: SignalProvider = {
  id: 'weather',
  produces: ['weather.condition'],
  resolve: ({ today }): Partial<Facts> => {
    const condition = today?.weather?.condition;
    return { 'weather.condition': condition ?? 'unknown' };
  },
};
