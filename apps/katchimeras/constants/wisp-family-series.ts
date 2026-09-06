import { WISP_CATALOG } from '@/constants/wisps';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import type { WispId } from '@/types/wisp';
import type { FamilyCosmeticReward, WispFamilySeries } from '@/types/wisp-family';

const PILOT: Partial<Record<KatchimeraFamilyId, { wisps: WispId[]; cosmetics: FamilyCosmeticReward[] }>> = {
  mossprout: {
    wisps: ['sprout', 'fern', 'bloom', 'grovelight', 'dewdrop'],
    cosmetics: [
      { category: 'body', itemId: 'moss' },
      { category: 'hat', itemId: 'moss-sprout' },
      { category: 'held', itemId: 'watering-can' },
    ],
  },
  baristabbit: {
    wisps: ['steam', 'crumb', 'feast', 'crema', 'bubble'],
    cosmetics: [
      { category: 'body', itemId: 'barista' },
      { category: 'hat', itemId: 'barista-beret' },
      { category: 'held', itemId: 'cozy-mug' },
    ],
  },
  pagelet: {
    wisps: ['page', 'shelf', 'chronicle', 'inkling', 'quill'],
    cosmetics: [
      { category: 'body', itemId: 'storybook-ink' },
      { category: 'hat', itemId: 'graduation-cap' },
      { category: 'held', itemId: 'tiny-storybook' },
    ],
  },
};

export const WISP_FAMILY_SERIES: readonly WispFamilySeries[] = WISP_CATALOG
  .filter((item) => item.semanticClass === 'family_signature' && item.primaryFamilyId)
  .map((signature) => {
    const familyId = signature.primaryFamilyId as KatchimeraFamilyId;
    const pilot = PILOT[familyId];
    const affinity = WISP_CATALOG
      .filter((item) => item.id !== signature.id && (item.primaryFamilyId === familyId || item.affinityFamilyIds.includes(familyId)))
      .map((item) => item.id);
    return {
      id: signature.seriesId ?? `${familyId}-constellation`,
      familyId,
      signatureWispId: signature.id,
      featuredWispIds: pilot?.wisps ?? [signature.id, ...affinity].slice(0, 5),
      cosmeticRewards: pilot?.cosmetics ?? [],
      pilot: Boolean(pilot),
    };
  });

export const PILOT_WISP_FAMILY_SERIES = WISP_FAMILY_SERIES.filter((series) => series.pilot);

export function wispFamilySeries(familyId: KatchimeraFamilyId) {
  return WISP_FAMILY_SERIES.find((series) => series.familyId === familyId) ?? null;
}
