import type { DiscoveryDef, DiscoveryRecord } from '@/types/discoveries';
import type { HomeDayRecord } from '@/types/home';
import type { Observation } from '@/utils/observations-engine';
import {
  STARTER_WORLD_PROPS,
  WORLD_PROP_CATALOG,
  isObservationKind,
  type WorldPropCategory,
  type WorldPropDef,
} from '@/utils/world-props-catalog';
import type { WorldPropsState } from '@/utils/world-props-storage';

export type WorldPropInventoryEntry = {
  def: WorldPropDef;
  owned: boolean;
  newlyAvailable: boolean;
  lockedLabel: string;
};

export type WorldPropInventory = {
  starterChoices: WorldPropDef[];
  owned: WorldPropInventoryEntry[];
  locked: WorldPropInventoryEntry[];
  byCategory: Record<WorldPropCategory, WorldPropInventoryEntry[]>;
  newlyAvailable: WorldPropInventoryEntry[];
};

type DiscoveryEntryLike = { def: Pick<DiscoveryDef, 'id'>; record: DiscoveryRecord | null };

export type WorldPropInventoryInput = {
  propsState: WorldPropsState;
  discoveryEntries: DiscoveryEntryLike[];
  observations: Observation[];
  days?: HomeDayRecord[];
};

function discoveryUnlocked(discoveryEntries: DiscoveryEntryLike[], id: string | undefined): boolean {
  return !!id && discoveryEntries.some((entry) => entry.def.id === id && !!entry.record);
}

function observationUnlocked(observations: Observation[], sourceId: string | undefined): boolean {
  if (!isObservationKind(sourceId)) return false;
  return observations.some((observation) => observation.kind === sourceId && observation.strength >= 2);
}

function moodUnlocked(days: HomeDayRecord[] | undefined, choiceId: string | undefined): boolean {
  if (!choiceId) return false;
  return (days ?? []).some((day) =>
    (day.promptAnswers ?? []).some(
      (answer) => !answer.dismissed && answer.kind === 'feeling' && answer.choiceIds.includes(choiceId)
    )
  );
}

function isOwned(
  def: WorldPropDef,
  propsState: WorldPropsState,
  discoveryEntries: DiscoveryEntryLike[],
  observations: Observation[],
  days: HomeDayRecord[]
): boolean {
  switch (def.unlockKind) {
    case 'starter':
      return propsState.starterPropId === def.id;
    case 'discovery':
      return discoveryUnlocked(discoveryEntries, def.unlockSourceId);
    case 'observation':
      return observationUnlocked(observations, def.unlockSourceId);
    case 'mood':
      return moodUnlocked(days, def.unlockSourceId);
    default:
      return false;
  }
}

export function deriveWorldPropInventory({
  propsState,
  discoveryEntries,
  observations,
  days = [],
}: WorldPropInventoryInput): WorldPropInventory {
  const entries = WORLD_PROP_CATALOG.map((def) => {
    const owned = isOwned(def, propsState, discoveryEntries, observations, days);
    return {
      def,
      owned,
      newlyAvailable: owned && !propsState.seenPropIds.includes(def.id),
      lockedLabel: def.lockedLabel,
    };
  });
  const owned = entries.filter((entry) => entry.owned);
  const locked = entries.filter((entry) => !entry.owned);
  const byCategory = entries.reduce(
    (acc, entry) => {
      acc[entry.def.category].push(entry);
      return acc;
    },
    { starter: [], nature: [], landmark: [], ritual: [], memory: [] } as Record<WorldPropCategory, WorldPropInventoryEntry[]>
  );

  return {
    starterChoices: STARTER_WORLD_PROPS,
    owned,
    locked,
    byCategory,
    newlyAvailable: entries.filter((entry) => entry.newlyAvailable),
  };
}
