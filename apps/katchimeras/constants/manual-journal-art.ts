import type { ImageSourcePropType } from 'react-native';

import type { ManualJournalFlowDefinition } from '@/utils/manual-journal-registry';

export const MANUAL_JOURNAL_ART = {
  people: require('@incubator/art-manual-journal/people.webp'),
  food: require('@incubator/art-manual-journal/food.webp'),
  went_somewhere: require('@incubator/art-manual-journal/went_somewhere.webp'),
  movement: require('@incubator/art-manual-journal/movement.webp'),
  studio: require('@incubator/art-manual-journal/studio.webp'),
  work: require('@incubator/art-manual-journal/work.webp'),
  big_event: require('@incubator/art-manual-journal/big_event.webp'),
  general: require('@incubator/art-manual-journal/general.webp'),
} satisfies Record<ManualJournalFlowDefinition['id'], ImageSourcePropType>;

export function manualJournalArt(flowId: string): ImageSourcePropType | null {
  return MANUAL_JOURNAL_ART[flowId as keyof typeof MANUAL_JOURNAL_ART] ?? null;
}
