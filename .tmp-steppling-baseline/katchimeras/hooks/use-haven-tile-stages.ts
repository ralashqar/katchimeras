import type { MergeWorldState } from '@/types/merge-world';
import { havenTileStagesFromRelationships } from '@/game/katchimeras/relationship-progression';
import { useRelationshipProgression } from '@/hooks/use-relationship-progression';

type HavenTileStages = MergeWorldState['haven']['tileStages'];

/** Relationship chapters, rather than the legacy Merge economy, own Haven growth. */
export function useHavenTileStages(): HavenTileStages {
  return havenTileStagesFromRelationships(useRelationshipProgression()) as HavenTileStages;
}
