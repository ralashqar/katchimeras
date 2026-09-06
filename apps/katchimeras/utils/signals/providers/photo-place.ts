import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';

// Source-bound resolutions are persisted with the day. Only confirmed or
// high-confidence decisions become aggregate facts; ambiguous candidates stay
// available to the photo quest evaluator but cannot silently complete a quest.
export const photoPlaceProvider: SignalProvider = {
  id: 'photo-place',
  produces: ['photo.place.categories'],
  resolve: ({ today }): Partial<Facts> => {
    const resolutions = today?.photoPlaceResolutions;
    if (!resolutions) return { 'photo.place.categories': 'unknown' };
    const categories = resolutions.flatMap((resolution) => {
      const candidate = resolution.selectedCandidate;
      if (!candidate) return [];
      const eligible =
        candidate.userConfirmed === true ||
        ((resolution.status === 'resolved' || resolution.status === 'category_only') &&
          resolution.confidenceScore >= 0.8);
      return eligible && candidate.normalizedCategory !== 'unknown'
        ? [candidate.normalizedCategory]
        : [];
    });
    return { 'photo.place.categories': Array.from(new Set(categories)) };
  },
};
