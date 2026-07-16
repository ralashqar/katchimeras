import type { ImageSourcePropType } from 'react-native';

import type { ManualJournalFlowDefinition } from '@/utils/manual-journal-registry';

export const MANUAL_JOURNAL_ART = {
  people: require('@/assets/images/katchimeras/manual-journal/people.webp'),
  food: require('@/assets/images/katchimeras/manual-journal/food.webp'),
  went_somewhere: require('@/assets/images/katchimeras/manual-journal/went_somewhere.webp'),
  movement: require('@/assets/images/katchimeras/manual-journal/movement.webp'),
  studio: require('@/assets/images/katchimeras/manual-journal/studio.webp'),
  work: require('@/assets/images/katchimeras/manual-journal/work.webp'),
  big_event: require('@/assets/images/katchimeras/manual-journal/big_event.webp'),
  general: require('@/assets/images/katchimeras/manual-journal/general.webp'),
} satisfies Record<ManualJournalFlowDefinition['id'], ImageSourcePropType>;

export function manualJournalArt(flowId: string): ImageSourcePropType | null {
  return MANUAL_JOURNAL_ART[flowId as keyof typeof MANUAL_JOURNAL_ART] ?? null;
}
