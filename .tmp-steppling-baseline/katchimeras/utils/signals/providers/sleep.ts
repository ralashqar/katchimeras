import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';

// Sleep signal provider (docs/signals-quests-architecture.md). Reads the day's
// Sleep Atmosphere (types/home DaySleep — manual one-tap or Apple Health),
// which records how the day BEGAN, i.e. last night's rest. So an "early night"
// quest accepted today completes when a later day logs good sleep — exactly
// the "track the next good night" behaviour we wanted.
//
// No sleep record for the day → 'unknown' (criterion stays incomplete rather
// than falsely reading as poor). A future overnight phone-idle heuristic can
// register a SECOND provider producing the same key when Health is absent.
export const sleepProvider: SignalProvider = {
  id: 'sleep',
  produces: ['sleep.quality'],
  resolve: ({ today }): Partial<Facts> => {
    const quality = today?.sleep?.quality;
    if (!quality) return { 'sleep.quality': 'unknown' };
    return { 'sleep.quality': quality === 'good' ? 'good' : 'low' };
  },
};
