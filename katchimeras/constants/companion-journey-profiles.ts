import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { MergeChainId, MergeLifeTheme } from '@/types/merge-world';

export const JOURNEY_MEDITATION_ORDER_GLOW = 8;
export const JOURNEY_MEDITATION_ORDER_MINUTES = 5;

export type CompanionJourneyProfile = {
  name: string;
  worldName: string;
  mergeChainId: MergeChainId;
  theme: MergeLifeTheme;
  requestTitles: readonly [string, string];
  lifeRequest: string;
};

/** Explicit rollout registry. A family is enabled only after its life-area
 * content and evidence adapter are authored; skins use their parent family. */
export const COMPANION_JOURNEY_PROFILES: Partial<Record<KatchimeraFamilyId, CompanionJourneyProfile>> = {
  steppling: {
    name: 'Steppling', worldName: 'our path', mergeChainId: 'adventure:trail', theme: 'movement',
    requestTitles: ['Pack a little comfort', 'Prepare the next path'],
    lifeRequest: '500 new steps, adapted movement, or a rest check-in',
  },
  mossprout: {
    name: 'Mossprout', worldName: 'our Garden', mergeChainId: 'nature:garden', theme: 'nature',
    requestTitles: ['A seed for tomorrow', 'A little green company'],
    lifeRequest: 'Notice something living, or take a quiet moment',
  },
};
