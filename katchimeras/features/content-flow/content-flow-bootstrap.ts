import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { activateStoredResidentCardDiscovery, grantStoredPlantableMemory, growStoredPlantableMemory, loadMergeWorldState, placeStoredPlantableMemory, revealStoredHaven, revealStoredMovementEgg, upgradeStoredHavenFeature, upgradeStoredStoryWorldTarget } from '@/utils/merge-world/repository';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { beginKatchimeraMeditation, katchimeraMeditationRecord } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET, mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { companionIdForFamily } from '@/constants/katchimera-skins';
import { companionBondProgress, recordCompanionBondEvent } from '@/utils/companion-bond';
import { loadCompanionBondState, saveCompanionBondState } from '@/utils/companion-bond-storage';
import { companionIdResolverForHomeState } from '@/utils/katchimera-identity';
import { loadCompanionQuests } from '@/utils/katchimera-quests';
import { homeRepository } from '@/storage/repositories/home-repository';

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
  registerContentFlowEffect('relationship.first_bloom_bond', async ({ effectKey }) => {
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const questState = loadCompanionQuests(resolveCompanionId);
    const bondState = loadCompanionBondState(questState, resolveCompanionId, homeState);
    const creatureId = companionIdForFamily('mossprout');
    const points = Math.max(0, MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints);
    if (points > 0) {
      const result = recordCompanionBondEvent(bondState, {
        id: effectKey,
        creatureId,
        kind: 'check_in_completed',
        points,
        occurredAt: Date.now(),
      }, { queueCelebration: true });
      if (result.awarded) saveCompanionBondState(result.state);
    }
    return { effectKey, target: MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET, points };
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
  registerContentFlowEffect('haven.grant_first_memory', async ({ run, effectKey }) => {
    const profile = loadOnboardingProfile();
    const seed = mossproutFirstSeedForIntent(profile.mossproutAnswers.growthIntentId);
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const granted = await grantStoredPlantableMemory(seed.id, { kind: 'ftue', sourceId }, effectKey);
    const instanceId = `memory-plant:${effectKey}`;
    if (!granted.changed) {
      const world = await loadMergeWorldState();
      if (!world.haven.plantableMemories.some((plant) => plant.id === instanceId)) {
        throw new Error('The first memory Seed could not be earned');
      }
    }
    return { effectKey, definitionId: seed.id, instanceId };
  });
  registerContentFlowEffect('haven.place_first_memory', async ({ run, effectKey }) => {
    const world = await loadMergeWorldState();
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const plant = world.haven.plantableMemories.find((candidate) => candidate.source.kind === 'ftue' && candidate.source.sourceId === sourceId)
      ?? world.haven.plantableMemories.find((candidate) => candidate.source.kind === 'ftue');
    if (!plant) throw new Error('The first memory Seed is missing');
    const placed = await placeStoredPlantableMemory(plant.id, 'front-left', effectKey);
    if (!placed.changed && !placed.state.haven.plantableMemories.some((candidate) => candidate.id === plant.id && candidate.slotId === 'front-left')) {
      throw new Error('The first memory Seed could not be planted');
    }
    return { effectKey, definitionId: plant.definitionId, instanceId: plant.id, slotId: 'front-left' };
  });
  registerContentFlowEffect('haven.grow_first_memory', async ({ run, effectKey }) => {
    const world = await loadMergeWorldState();
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const plant = world.haven.plantableMemories.find((candidate) => candidate.source.kind === 'ftue' && candidate.source.sourceId === sourceId)
      ?? world.haven.plantableMemories.find((candidate) => candidate.source.kind === 'ftue');
    if (!plant) throw new Error('The first memory Seed is missing');
    await growStoredPlantableMemory(plant.id, 1, effectKey);
    return { effectKey, instanceId: plant.id, growthPoints: plant.growthPoints + 1 };
  });
  registerContentFlowEffect('haven.feature.upgrade', async ({ effectKey, payload }) => {
    const featureId = payload.featureId === 'path' ? 'path' : 'spring';
    const result = await upgradeStoredHavenFeature(featureId, Number(payload.toLevel ?? 1), effectKey);
    if (!result.changed && !result.state.haven.mutationReceipts.some((receipt) => receipt.id === effectKey)) throw new Error(result.message ?? 'Garden feature could not be restored');
    return { effectKey, featureId, level: result.state.haven.structures.mossproutGarden.featureLevels[featureId] };
  });
  registerContentFlowEffect('haven.movement_egg.reveal', async ({ effectKey }) => revealStoredMovementEgg(effectKey));
  registerContentFlowEffect('haven.reveal', async ({ effectKey }) => {
    const result = await revealStoredHaven();
    return { effectKey, revealState: result.state.haven.revealState };
  });
  registerContentFlowEffect(STORY_WORLD_UPGRADE_EFFECT, async ({ effectKey, payload }) => {
    const result = await upgradeStoredStoryWorldTarget(effectKey, payload as StoryWorldUpgradeEffectPayload);
    if (!result.storyWorldMutationReceipt) throw new Error(result.message ?? 'The authored world upgrade could not be applied');
    return result.storyWorldMutationReceipt;
  });
  bootstrapped = true;
}
