import type { HomeVisualKey, LocalCreatureRecord } from '@/types/home';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { identityForCreature, identityForEncounter } from '@/utils/katchimera-identity';
import {
  TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS,
  type TodayKatchimeraExplorationBackgroundKey,
} from '@/constants/today-exploration-background-keys.gen';

export type {
  TodayExplorationBackgroundKey,
  TodayKatchimeraExplorationBackgroundKey,
} from '@/constants/today-exploration-background-keys.gen';

const backgroundKeys = new Set<string>(
  TODAY_KATCHIMERA_EXPLORATION_BACKGROUND_KEYS,
);

type ExplorationCreatureIdentity = Pick<
  LocalCreatureRecord,
  | 'aspectId'
  | 'familyId'
  | 'skinId'
  | 'companionId'
  | 'encounterProfileId'
  | 'visualKey'
>;

export function todayKatchimeraExplorationBackgroundKeyForFamily(
  familyId: KatchimeraFamilyId | null | undefined,
): TodayKatchimeraExplorationBackgroundKey | null {
  return familyId && backgroundKeys.has(familyId)
    ? familyId as TodayKatchimeraExplorationBackgroundKey
    : null;
}

export function todayKatchimeraExplorationBackgroundKeyForCreature(
  creature: ExplorationCreatureIdentity | null | undefined,
): TodayKatchimeraExplorationBackgroundKey | null {
  if (!creature) return null;
  if (backgroundKeys.has(creature.visualKey)) {
    return creature.visualKey as TodayKatchimeraExplorationBackgroundKey;
  }
  return todayKatchimeraExplorationBackgroundKeyForFamily(
    identityForCreature(creature)?.familyId,
  );
}

export function todayKatchimeraExplorationBackgroundKeyForEnvironment(
  environmentVisualKey: HomeVisualKey | null | undefined,
): TodayKatchimeraExplorationBackgroundKey | null {
  if (!environmentVisualKey) return null;
  // Exported environment assets are authored against visual keys. Prefer that
  // direct identity before the companion-family fallback: some anchor
  // creatures (for example Bedrotte) belong to a broader family whose id does
  // not match the environment visual key.
  if (backgroundKeys.has(environmentVisualKey)) {
    return environmentVisualKey as TodayKatchimeraExplorationBackgroundKey;
  }
  return todayKatchimeraExplorationBackgroundKeyForFamily(
    identityForEncounter(null, environmentVisualKey)?.familyId,
  );
}

/**
 * The authored day environment is authoritative. Creature identity is only a
 * fallback for legacy days that predate an explicit card environment.
 */
export function todayKatchimeraExplorationBackgroundKeyForPresentation({
  creature,
  environmentVisualKey,
}: {
  creature: ExplorationCreatureIdentity | null | undefined;
  environmentVisualKey: HomeVisualKey | null | undefined;
}): TodayKatchimeraExplorationBackgroundKey | null {
  return environmentVisualKey
    ? todayKatchimeraExplorationBackgroundKeyForEnvironment(environmentVisualKey)
    : todayKatchimeraExplorationBackgroundKeyForCreature(creature);
}
