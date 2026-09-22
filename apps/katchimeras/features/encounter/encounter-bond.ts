import { companionIdForFamily } from '@/constants/katchimera-skins';
import type { MergeWorldCommandResult } from '@/types/merge-world';
import { COMPANION_BOND_REWARDS, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { localDayId } from '@/utils/world-identity-rules';

/**
 * A cleared encounter deepens the Bond with the Katchimera who was there, and
 * counts toward their friend's daily sparks. Recorded once per receipt (the
 * Bond ledger refuses a repeated id), from the world's own result.
 */
export function recordEncounterBond(result: MergeWorldCommandResult, now = Date.now()): boolean {
  const cleared = result.encounterCleared;
  if (!cleared) return false;
  const state = loadCompanionBondState();
  const awarded = recordCompanionBondEvent(state, {
    id: `mist:${cleared.missionId}:${result.state.encounters?.lastOutcome?.receiptId ?? now}`,
    creatureId: companionIdForFamily(cleared.katchimeraId),
    kind: 'mist_cleared',
    points: COMPANION_BOND_REWARDS.mist_cleared,
    occurredAt: now,
    dayId: localDayId(new Date(now)),
  }, { queueCelebration: false });
  if (awarded.awarded) saveCompanionBondState(awarded.state);
  return awarded.awarded;
}
