import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';

// Photo-label signal provider (docs/signals-quests-architecture.md). NOT new
// analysis: the on-device Apple Vision module (modules/katchimera-vision via
// utils/photo-vision) already reads the day's photos and stores a
// DayVisionSummary whose `concepts` are canonicalised labels (coffee, cat,
// flowers, sunset, mountains…). This provider simply exposes those concept
// names as the `photo.labels` fact so quests can test `includes 'cat'`.
//
// No vision read on the day (module absent, or photos not analysed yet) →
// 'unknown', so subject-photo criteria stay incomplete rather than failing.
export const photoLabelsProvider: SignalProvider = {
  id: 'photo-labels',
  produces: ['photo.labels'],
  resolve: ({ today }): Partial<Facts> => {
    const vision = today?.vision;
    if (!vision || (vision.analyzedPhotoCount ?? 0) === 0) return { 'photo.labels': 'unknown' };
    // Canonical concepts first (grouped, generic-free), plus the specific raw
    // details so a quest can match either the grouped or the exact label.
    const labels = [
      ...vision.concepts.map((concept) => concept.name),
      ...vision.details.map((detail) => detail.toLowerCase()),
    ];
    return { 'photo.labels': Array.from(new Set(labels)) };
  },
};
