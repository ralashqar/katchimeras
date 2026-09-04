import { MOSSPROUT_JOURNEY_CAMPAIGN } from '@/constants/mossprout-journey-campaign';
import { nextUnearnedMossproutResident } from '@/constants/resident-card-discovery';
import { MOSSPROUT_FTUE_VARIANTS } from '@/features/onboarding/mossprout-ftue-flow';
import { GLOW_DISCOVERY_FLOW } from '@/features/onboarding/glow-discovery-flow';
import { STEPPLING_DAY_ONE_FLOW } from './steppling-day-one-flow';
import { grantStoredGeneratorParcel } from '@/utils/merge-world/repository';
import { startGlowDiscovery } from '@/features/onboarding/glow-discovery-runtime';
import { applyStoredGlowDiscovery } from '@/utils/merge-world/repository';
import { GLOW_GATEWAY_ID } from '@/utils/merge-world/glow-discovery-policy';
import type { KatchimeraFamilyId, KatchimeraSkinId } from '@/types/katchimera';
import type { StoryWorldUpgradeEffectPayload } from '@/types/content-flow';
import { activateStoredResidentCardDiscovery, ensureStoredFirstFtueMemoryPlacement, grantStoredPlantableMemory, growStoredPlantableMemory, loadMergeWorldState, revealStoredHaven, revealStoredMovementEgg, seedStoredMossproutGardenAfterFtue, upgradeStoredHavenFeature, upgradeStoredStoryWorldTarget } from '@/utils/merge-world/repository';
import { firstFtueMemoryForSource } from '@/utils/merge-world/first-ftue-memory';
import { completeDayOneLesson } from '@/game/katchimeras/action-runtime';
import { beginKatchimeraMeditation, completeMossproutJourneyResolution, katchimeraMeditationRecord } from '@/game/katchimeras/relationship-progression';
import { relationshipProgressionRepository } from '@/storage/repositories/relationship-progression-repository';
import { loadOnboardingProfile } from '@/utils/onboarding-state';
import { MOSSPROUT_FTUE_FAMILIAR_BOND_TARGET, MOSSPROUT_FTUE_NAME_BOND_TARGET, mossproutFirstSeedForIntent } from '@/features/onboarding/mossprout-bond-share';
import { localDayId } from '@/utils/world-identity';
import { keepMossproutFirstSeed } from '@/features/onboarding/mossprout-profile';
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
  registerContentFlowDefinition(GLOW_DISCOVERY_FLOW);
  registerContentFlowDefinition(STEPPLING_DAY_ONE_FLOW);
  registerContentFlowEffect('journey.grant_generator_parcel', async ({ run, payload }) => {
    const generatorId = String(payload.generatorId);
    const rewardId = String(payload.rewardId);
    const result = await grantStoredGeneratorParcel(generatorId, rewardId, String(run.variables.dayId ?? localDayId()));
    if (!result.changed && !result.state.generators[generatorId] && !result.state.arrivals.some((arrival) => arrival.id === rewardId)) throw new Error('The Garden parcel could not be delivered. Please try again.');
    return { rewardId, generatorId };
  });
  registerContentFlowEffect('haven.start_glow_discovery', async ({ effectKey }) => {
    await seedStoredMossproutGardenAfterFtue(localDayId());
    await startGlowDiscovery();
    return { effectKey };
  });
  for (const [capability, type] of [
    ['glow.lesson.prepare', 'prepareGlowDiscoveryLesson'],
  ] as const) {
    registerContentFlowEffect(capability, async () => {
      const result = await applyStoredGlowDiscovery({ type, now: Date.now() });
      if (!result.changed && result.message) throw new Error(result.message);
      return { targetId: GLOW_GATEWAY_ID, revision: result.state.revision };
    });
  }
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
    const homeState = homeRepository.load();
    const resolveCompanionId = companionIdResolverForHomeState(homeState);
    const bondState = loadCompanionBondState(loadCompanionQuests(resolveCompanionId), resolveCompanionId, homeState);
    const creatureId = companionIdForFamily('mossprout');
    const points = Math.max(0, MOSSPROUT_FTUE_NAME_BOND_TARGET - companionBondProgress(bondState, creatureId).totalPoints);
    if (points > 0) {
      const result = recordCompanionBondEvent(bondState, { id: `ftue-bond-share:${String(run.variables.ftueRunId ?? run.runId)}`, creatureId, kind: 'check_in_completed', points, occurredAt: completedAt });
      if (result.awarded) saveCompanionBondState(result.state);
    }
    keepMossproutFirstSeed();
    return { effectKey, completedAt, flowRunId: run.runId };
  });
  registerContentFlowEffect('haven.prepare_merge_handoff', async ({ effectKey }) => {
    await seedStoredMossproutGardenAfterFtue(localDayId());
    return { effectKey };
  });
  registerContentFlowEffect('relationship.first_bloom_bond', async ({ effectKey }) => {
    relationshipProgressionRepository.update((state) => {
      const journey = [...state.journeyDays].reverse().find((day) => day.familyId === 'mossprout' && day.beatId === 'quiet-patch:first-flower');
      return journey ? completeMossproutJourneyResolution(state, journey.dayId) : state;
    });
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
    const existing = firstFtueMemoryForSource(await loadMergeWorldState(), sourceId);
    if (existing) return { effectKey, definitionId: existing.definitionId, instanceId: existing.id };
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
    const sourceId = typeof run.variables.ftueRunId === 'string' ? run.variables.ftueRunId : run.runId;
    const placed = await ensureStoredFirstFtueMemoryPlacement(sourceId, effectKey);
    const plant = firstFtueMemoryForSource(placed.state, sourceId);
    if (!placed.placed || !plant) {
      throw new Error('The first memory Seed could not be planted');
    }
    return { effectKey, definitionId: plant.definitionId, instanceId: plant.id, slotId: plant.slotId };
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
