import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { MOSSPROUT_FTUE_SCRIPT } from '@/features/onboarding/mossprout-ftue-script';
import type { KatchimeraSkinId } from '@/types/katchimera';
import { activateStoredResidentCardDiscovery, loadMergeWorldState } from '@/utils/merge-world/repository';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

import { registerContentFlowEffect } from './content-flow-capabilities';
import { registerContentFlowDefinition } from './content-flow-catalog';
import { compileFtueFlow } from './ftue-flow-adapter';
import { compileJourneyCampaignFlows } from './journey-flow-compiler';

let bootstrapped = false;

export function bootstrapContentFlowCatalog() {
  if (bootstrapped) return;
  registerContentFlowDefinition(compileFtueFlow(MOSSPROUT_FTUE_SCRIPT));
  compileJourneyCampaignFlows(MOSSPROUT_JOURNEY_CAMPAIGN).forEach(registerContentFlowDefinition);
  registerContentFlowEffect('resident.grant_parcel', async ({ run, effectKey, payload }) => {
    const world = await loadMergeWorldState();
    const earned = world.ownedKatchimeraCards.filter((card) => card.familyId === 'mossprout').map((card) => card.cardId);
    const selection = payload.selection;
    const preferred = selection === 'matched'
      ? run.variables.matchedCardId as KatchimeraSkinId | null
      : typeof selection === 'string' && selection !== 'next_unearned'
        ? selection as KatchimeraSkinId
        : null;
    const residentId = nextUnearnedMossproutResident(earned, preferred);
    if (!residentId) throw new Error('No unearned Mossprout resident is available for this flow');
    const dayId = typeof run.variables.dayId === 'string' ? run.variables.dayId : run.runId;
    const result = await activateStoredResidentCardDiscovery('mossprout:journey', dayId, residentId);
    if (!result.changed && !result.state.residentCardDiscovery.records.some((record) => record.journeyDayId === dayId && record.residentId === residentId)) {
      throw new Error('The resident parcel could not be granted');
    }
    return { effectKey, residentId, dayId };
  });
  registerContentFlowEffect('optional_action.publish', async ({ effectKey, payload }) => ({ effectKey, action: payload.action }));
  registerContentFlowEffect('relationship.complete_day_one_lesson', async ({ run, effectKey }) => {
    const completedAt = Date.now();
    relationshipProgressionRepository.update((state) => completeDayOneLesson(state, { completedAt, flowRunId: run.runId }));
    return { effectKey, completedAt, flowRunId: run.runId };
  });
  bootstrapped = true;
}
