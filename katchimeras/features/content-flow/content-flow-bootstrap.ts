import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import type { KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { activateStoredResidentCardDiscovery, loadMergeWorldState, upgradeStoredStoryWorldTarget } from '@/utils/merge-world/repository';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { beginKatchimeraMeditation, katchimeraMeditationRecord } from '@/game/katchimeras/relationship-progression';
import type { KatchimeraFamilyId } from '@/types/katchimera';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';

import { registerContentFlowEffect } from './content-flow-capabilities';
import { registerContentFlowDefinition } from './content-flow-catalog';
import { compileJourneyCampaignFlows } from './journey-flow-compiler';
import { STORY_WORLD_UPGRADE_EFFECT } from './story-world-operations';
import { registerStoryVariantSet } from './story-variant-registry';

let bootstrapped = false;

export function bootstrapContentFlowCatalog() {
  if (bootstrapped) return;
  registerStoryVariantSet(MOSSPROUT_FTUE_VARIANTS);
  MOSSPROUT_FTUE_VARIANTS.variants.forEach((variant) => registerContentFlowDefinition(variant.definition));
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
  registerContentFlowEffect('relationship.begin_meditation', async ({ run, effectKey, payload }) => {
    const familyId = payload.familyId as KatchimeraFamilyId;
    const durationMs = Number(payload.durationMs);
    const sourceId = `ftue:${String(run.variables.ftueRunId ?? run.runId)}:first-rest`;
    const startedAt = Date.now();
    relationshipProgressionRepository.update((state) => beginKatchimeraMeditation(
      state,
      familyId,
      startedAt,
      durationMs,
      sourceId,
    ));
    const meditation = katchimeraMeditationRecord(relationshipProgressionRepository.load(), familyId);
    if (!meditation) throw new Error('The companion meditation could not be started');
    return { effectKey, familyId, sourceId, startedAt: meditation.startedAt, availableAt: meditation.availableAt };
  });
  registerContentFlowEffect(STORY_WORLD_UPGRADE_EFFECT, async ({ effectKey, payload }) => {
    const result = await upgradeStoredStoryWorldTarget(effectKey, payload as StoryWorldUpgradeEffectPayload);
    if (!result.storyWorldMutationReceipt) throw new Error(result.message ?? 'The authored world upgrade could not be applied');
    return result.storyWorldMutationReceipt;
  });
  bootstrapped = true;
}
