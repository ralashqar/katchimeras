import type { Facts } from '@/utils/signals/facts';
import type { SignalProvider } from '@/utils/signals/resolve';
import { buildLegacyVisionEvidence } from '@/utils/intelligence/evidence';

export const evidenceProvider: SignalProvider = {
  id: 'evidence',
  produces: ['evidence.items'],
  resolve: ({ today }): Partial<Facts> => {
    if (!today) return { 'evidence.items': [] };
    if (today.evidence && today.evidence.length > 0) {
      return { 'evidence.items': today.evidence };
    }
    if (today.vision && (today.vision.analyzedPhotoCount ?? 0) > 0) {
      return {
        'evidence.items': [
          buildLegacyVisionEvidence(today.id, `${today.isoDate}T12:00:00.000Z`, today.vision),
        ],
      };
    }
    return { 'evidence.items': [] };
  },
};

