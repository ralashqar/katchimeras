import { useSyncExternalStore } from 'react';

import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

export function useRelationshipProgression() {
  return useSyncExternalStore(
    relationshipProgressionRepository.subscribe,
    relationshipProgressionRepository.load,
    relationshipProgressionRepository.load,
  );
}
